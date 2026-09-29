from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2, os, uuid
from detector import VideoAnalyzer
from sensors import get_sensors

app = FastAPI(title='Sentinel AI API', version='2.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sentinel-gpvf2f9a3-ignite-99f0.vercel.app",
        "https://sentinel-ai-git-main-ignite-99f0.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
UPLOAD_DIR = 'uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)
sessions = {}
@app.get("/")
def root():
    return {
        "status": "online",
        "system": "Sentinel AI API",
        "message": "Backend is running"
    }

@app.get('/api/health')
def health():
    return {'status': 'online', 'system': 'Sentinel AI', 'problem': 'SIH26187'}


@app.post('/api/session')
async def create_session(video: UploadFile = File(...), camera_id: str = Form('BOP-01'), night_mode: bool = Form(False)):
    sid = str(uuid.uuid4())[:8]
    path = os.path.join(UPLOAD_DIR, f'{sid}_{video.filename}')
    with open(path, 'wb') as f:
        f.write(await video.read())
    sessions[sid] = VideoAnalyzer(path, camera_id, night_mode)
    return {'session_id': sid, 'camera_id': camera_id, 'status': 'ready'}


@app.get('/api/stream/{sid}')
def stream(sid: str):
    if sid not in sessions:
        return {'error': 'session not found'}
    analyzer = sessions[sid]

    def generate():
        while True:
            frame, _ = analyzer.next_frame()
            if frame is None:
                break
            ok, enc = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
            if ok:
                yield b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + enc.tobytes() + b'\r\n'
    return StreamingResponse(generate(), media_type='multipart/x-mixed-replace; boundary=frame')


@app.get('/api/status/{sid}')
def status(sid: str):
    if sid not in sessions:
        return {'error': 'session not found'}
    return sessions[sid].status()


@app.get('/api/events/{sid}')
def events(sid: str):
    if sid not in sessions:
        return {'error': 'session not found'}
    return {'events': sessions[sid].events[-50:]}


@app.get('/api/analytics/{sid}')
def analytics(sid: str):
    if sid not in sessions:
        return {'error': 'session not found'}
    return sessions[sid].analytics()


@app.post('/api/fence/{sid}')
def fence(sid: str, x1: int, y1: int, x2: int, y2: int):
    if sid not in sessions:
        return {'error': 'session not found'}
    sessions[sid].set_fence(x1, y1, x2, y2)
    return {'fence': [x1, y1, x2, y2]}


@app.post('/api/control/{sid}')
def control(sid: str, action: str):
    if sid not in sessions:
        return {'error': 'session not found'}
    analyzer = sessions[sid]
    if action == 'pause':
        analyzer.pause()
    elif action == 'resume':
        analyzer.resume()
    elif action == 'stop':
        analyzer.stop()
    elif action == 'restart':
        analyzer.restart()
    else:
        return {'error': f'unknown action: {action}'}
    return analyzer.status()


@app.get('/api/sensors')
def sensors():
    return get_sensors()
