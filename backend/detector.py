import cv2, math, time, os, base64
from pathlib import Path
from collections import defaultdict, deque
from ultralytics import YOLO

PERSON = 0
VEHICLES = {2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'}
# COCO class 43 is 'knife' - the stock model can already detect this, no extra weights needed.
KNIFE = 43
# Guns/pistols/rifles are NOT part of the COCO80 label set the base yolo11n.pt is trained on,
# so real gun detection needs a separately trained weapon-detection model. We load one here if
# the weights are present; if not, we degrade gracefully instead of pretending to detect guns.
BACKEND_DIR = Path(__file__).resolve().parent
_configured_gun_path = os.environ.get('GUN_MODEL_PATH')
if _configured_gun_path:
    _configured_path = Path(_configured_gun_path)
    GUN_MODEL_PATH = _configured_path if _configured_path.is_absolute() else (
        Path.cwd() / _configured_path if (Path.cwd() / _configured_path).is_file()
        else BACKEND_DIR / _configured_path
    )
else:
    GUN_MODEL_PATH = BACKEND_DIR / 'weights' / 'gun_detector.pt'
GUN_CONF = float(os.environ.get('GUN_CONF', 0.45))
FIREARM_LABELS = {'gun', 'firearm', 'pistol', 'handgun', 'rifle', 'revolver', 'shotgun', 'weapon'}
NIGHT_BRIGHTNESS_THRESHOLD = 55
RISK_HISTORY_EVERY_N_FRAMES = 15  # ~ every 0.5-1s depending on source fps


class VideoAnalyzer:
    def __init__(self, path, camera_id='BOP-01', night_mode=False):
        self.cap = cv2.VideoCapture(path)
        self.camera_id = camera_id
        self.night_mode = night_mode
        self.model = YOLO('yolo11n.pt')
        self.frame_no = 0
        self.people_now = 0
        self.vehicles_now = 0
        self.weapons_now = 0
        self.suspicious_now = 0
        self.peak_people = 0
        self.peak_vehicles = 0
        self.peak_weapons = 0
        self.alerts = 0
        self.risk = 0
        self.last_alert = ''
        self.risk_history = []  # [{'t': video_seconds, 'risk': int}]
        self.gun_model = None
        self.gun_model_loaded = False
        if GUN_MODEL_PATH.is_file():
            try:
                self.gun_model = YOLO(str(GUN_MODEL_PATH))
                self.gun_model_loaded = True
            except Exception as e:
                print(f'[Sentinel AI] Could not load gun detection weights at {GUN_MODEL_PATH}: {e}')
        else:
            print(f'[Sentinel AI] No gun-detection weights found at {GUN_MODEL_PATH} - knife detection via COCO stays '
                  f'active, firearm detection is disabled until a trained weapon model is placed there.')
        self.events = []
        self.tracks = defaultdict(lambda: deque(maxlen=25))
        self.loiter_flagged = set()  # track ids already counted as loitering this session
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 25
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        self.fence = [0, 0, max(1, self.width // 2), self.height]
        self.paused = False
        self.stopped = False
        self.started_at = time.time()
        self.last_frame = None

    def pause(self):
        self.paused = True

    def resume(self):
        if not self.stopped:
            self.paused = False

    def stop(self):
        self.stopped = True
        self.paused = False

    def restart(self):
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        self.frame_no = 0
        self.people_now = self.vehicles_now = self.weapons_now = self.suspicious_now = 0
        self.peak_people = self.peak_vehicles = self.peak_weapons = 0
        self.alerts = 0
        self.risk = 0
        self.last_alert = ''
        self.events = []
        self.risk_history = []
        self.tracks = defaultdict(lambda: deque(maxlen=25))
        self.loiter_flagged = set()
        self.last_frame = None
        self.paused = False
        self.stopped = False

    def set_fence(self, x1, y1, x2, y2):
        self.fence = [x1, y1, x2, y2]

    def inside(self, x, y):
        x1, y1, x2, y2 = self.fence
        return min(x1, x2) <= x <= max(x1, x2) and min(y1, y2) <= y <= max(y1, y2)

    def emit(self, level, title, reason, track_id=None):
        stamp = round(self.frame_no / self.fps, 1)
        key = f'{title}:{track_id}'
        if self.events and self.events[-1]['key'] == key and stamp - self.events[-1]['video_time'] < 3:
            return
        self.events.append({
            'id': len(self.events) + 1, 'key': key, 'level': level, 'title': title,
            'camera': self.camera_id, 'video_time': stamp, 'wall_time': time.strftime('%H:%M:%S'),
            'reason': reason, 'track_id': track_id, 'snapshot': None,
        })
        self.alerts += 1
        self.last_alert = title

    def _enhance_low_light(self, frame):
        """CLAHE-based low-light enhancement: boosts local contrast on the luminance channel so the
        detector sees more structure in dim CCTV footage, without the fake claim of thermal/IR imaging."""
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        l = clahe.apply(l)
        return cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)

    def _snapshot(self, frame):
        small = cv2.resize(frame, (200, int(200 * self.height / max(1, self.width))))
        ok, enc = cv2.imencode('.jpg', small, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if not ok:
            return None
        return 'data:image/jpeg;base64,' + base64.b64encode(enc.tobytes()).decode('ascii')

    def next_frame(self):
        if self.stopped:
            return None, {}
        if self.paused:
            time.sleep(0.08)
            return self.last_frame, {'paused': True}
        ok, raw = self.cap.read()
        if not ok:
            return None, {}
        self.frame_no += 1

        gray = cv2.cvtColor(raw, cv2.COLOR_BGR2GRAY)
        brightness = float(gray.mean())
        low_light = brightness < NIGHT_BRIGHTNESS_THRESHOLD
        detect_frame = self._enhance_low_light(raw) if low_light else raw
        frame = raw  # draw overlays on the original-exposure frame so the operator sees the real scene

        events_before = len(self.events)
        result = self.model.track(detect_frame, persist=True, classes=[0, 2, 3, 5, 7, KNIFE], conf=0.35, verbose=False)[0]
        people = vehicles = fence_hits = loitering = weapons = suspicious = 0

        if result.boxes is not None:
            for box in result.boxes:
                cls = int(box.cls[0]); conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0]); cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                tid = int(box.id[0]) if box.id is not None else -1

                if cls == PERSON:
                    people += 1
                    label = f'PERSON {conf:.0%}'
                    self.tracks[tid].append((cx, cy))
                    in_zone = self.inside(cx, cy)
                    if in_zone:
                        fence_hits += 1
                        self.risk = min(100, 60 + (20 if self.night_mode or low_light else 0))
                        self.emit('HIGH', 'VIRTUAL FENCE INTRUSION',
                                   f'Person track {tid} entered the restricted zone' +
                                   (' during night/low-light conditions' if self.night_mode or low_light else ''), tid)
                    pts = list(self.tracks[tid])
                    is_loitering = False
                    if len(pts) >= 15:
                        travel = sum(math.dist(pts[i - 1], pts[i]) for i in range(1, len(pts)))
                        displacement = math.dist(pts[0], pts[-1])
                        if travel > 160 and displacement < 55:
                            is_loitering = True
                            loitering += 1
                            self.emit('MEDIUM', 'SUSPICIOUS LOITERING',
                                       f'Track {tid} shows repeated movement in a confined area', tid)
                    # Composite behavioural signal: loitering + (restricted zone or darkness) escalates
                    # from a loitering note to an explicit suspicious-person alert.
                    if is_loitering and (in_zone or low_light or self.night_mode):
                        suspicious += 1
                        self.risk = max(self.risk, 80)
                        self.emit('HIGH', 'SUSPICIOUS PERSON DETECTED',
                                   f'Track {tid} combines loitering with ' +
                                   ('restricted-zone presence' if in_zone else 'low-light concealment') +
                                   ' - flagged for operator review', tid)
                    box_color = (0, 0, 255) if (in_zone or is_loitering) else (30, 220, 120)
                elif cls in VEHICLES:
                    vehicles += 1
                    label = f'{VEHICLES[cls].upper()} {conf:.0%}'
                    box_color = (30, 220, 120)
                elif cls == KNIFE:
                    weapons += 1
                    label = f'WEAPON (KNIFE) {conf:.0%}'
                    self.risk = 100
                    self.emit('CRITICAL', 'WEAPON DETECTED',
                               f'Edged weapon identified near track {tid}' +
                               (' inside the restricted zone' if self.inside(cx, cy) else ''), tid)
                    box_color = (0, 0, 255)
                else:
                    continue

                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2 if box_color == (30, 220, 120) else 3)
                cv2.putText(frame, label, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, .55, box_color, 2)
                cv2.circle(frame, (cx, cy), 4, (255, 255, 255), -1)
                if tid >= 0:
                    cv2.putText(frame, f'ID {tid}', (x1, min(self.height - 8, y2 + 18)), cv2.FONT_HERSHEY_SIMPLEX, .45, (255, 255, 255), 1)

        # Optional second pass: firearm detection via a dedicated weapon model, if weights were supplied.
        if self.gun_model_loaded:
            try:
                gresult = self.gun_model.predict(detect_frame, conf=GUN_CONF, verbose=False)[0]
                if gresult.boxes is not None:
                    for gbox in gresult.boxes:
                        gconf = float(gbox.conf[0]); gx1, gy1, gx2, gy2 = map(int, gbox.xyxy[0])
                        gun_class = int(gbox.cls[0])
                        gun_names = self.gun_model.names
                        gname = (gun_names[gun_class] if isinstance(gun_names, list) else gun_names.get(gun_class, 'FIREARM')).lower()
                        if gname not in FIREARM_LABELS and not any(label in gname for label in FIREARM_LABELS):
                            continue
                        gname = gname.upper()
                        weapons += 1; self.risk = 100
                        self.emit('CRITICAL', 'WEAPON DETECTED',
                                   f'{gname} identified at ({(gx1+gx2)//2},{(gy1+gy2)//2}) with {gconf:.0%} confidence')
                        cv2.rectangle(frame, (gx1, gy1), (gx2, gy2), (0, 0, 255), 3)
                        cv2.putText(frame, f'{gname} {gconf:.0%}', (gx1, max(20, gy1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, .6, (0, 0, 255), 2)
            except Exception as e:
                print(f'[Sentinel AI] Gun-detection pass failed: {e}')

        self.people_now, self.vehicles_now, self.weapons_now, self.suspicious_now = people, vehicles, weapons, suspicious
        self.peak_people = max(self.peak_people, people)
        self.peak_vehicles = max(self.peak_vehicles, vehicles)
        self.peak_weapons = max(self.peak_weapons, weapons)

        if low_light and people > 0:
            self.night_mode = True
            self.risk = max(self.risk, 40)
            self.emit('MEDIUM', 'NIGHT MOVEMENT DETECTED', f'Low-light scene with {people} detected person(s)')

        fx1, fy1, fx2, fy2 = self.fence
        cv2.rectangle(frame, (fx1, fy1), (fx2, fy2), (40, 80, 240), 3)
        cv2.putText(frame, 'RESTRICTED VIRTUAL FENCE', (fx1 + 10, max(25, fy1 + 28)), cv2.FONT_HERSHEY_SIMPLEX, .7, (40, 80, 240), 2)
        cv2.rectangle(frame, (0, 0), (self.width, 58), (18, 24, 32), -1)
        cv2.putText(frame, f'Sentinel AI | {self.camera_id} | LIVE ANALYTICS' + (' | LOW-LIGHT ENHANCED' if low_light else ''),
                     (18, 37), cv2.FONT_HERSHEY_SIMPLEX, .8, (255, 255, 255), 2)
        if self.last_alert:
            cv2.putText(frame, f'ALERT: {self.last_alert}', (max(10, self.width - 520), 37), cv2.FONT_HERSHEY_SIMPLEX, .65, (30, 80, 255), 2)

        self.last_frame = frame.copy()

        # Attach one evidence snapshot per frame to every event raised this frame (cheaper than
        # encoding a JPEG per detection when several alerts fire on the same frame).
        if len(self.events) > events_before:
            snap = self._snapshot(frame)
            for i in range(events_before, len(self.events)):
                self.events[i]['snapshot'] = snap

        if self.frame_no % RISK_HISTORY_EVERY_N_FRAMES == 0:
            self.risk_history.append({'t': round(self.frame_no / self.fps, 1), 'risk': self.risk})

        return frame, {'people': people, 'vehicles': vehicles, 'weapons': weapons, 'suspicious': suspicious,
                        'fence_hits': fence_hits, 'loitering': loitering, 'risk': self.risk, 'frame': self.frame_no}

    def status(self):
        state = 'STOPPED' if self.stopped else ('PAUSED' if self.paused else (
            'ENDED' if self.frame_no > 0 and self.cap.get(cv2.CAP_PROP_POS_FRAMES) >= self.cap.get(cv2.CAP_PROP_FRAME_COUNT) else 'LIVE'))
        return {
            'state': state, 'camera': self.camera_id, 'frame': self.frame_no,
            'people_now': self.people_now, 'vehicles_now': self.vehicles_now,
            'weapons_now': self.weapons_now, 'suspicious_now': self.suspicious_now,
            'peak_people': self.peak_people, 'peak_vehicles': self.peak_vehicles, 'peak_weapons': self.peak_weapons,
            'gun_model_loaded': self.gun_model_loaded, 'gun_model_path': str(GUN_MODEL_PATH),
            'alerts': self.alerts, 'risk': self.risk,
            'night_mode': self.night_mode, 'fence': self.fence, 'last_alert': self.last_alert, 'events': len(self.events),
        }

    def analytics(self):
        breakdown = {}
        for e in self.events:
            breakdown[e['title']] = breakdown.get(e['title'], 0) + 1
        level_breakdown = {}
        for e in self.events:
            level_breakdown[e['level']] = level_breakdown.get(e['level'], 0) + 1
        return {
            'risk_history': self.risk_history[-180:],
            'breakdown_by_type': breakdown,
            'breakdown_by_level': level_breakdown,
            'totals': {'peak_people': self.peak_people, 'peak_vehicles': self.peak_vehicles, 'peak_weapons': self.peak_weapons,
                       'alerts': self.alerts, 'risk': self.risk},
            'camera': self.camera_id, 'gun_model_loaded': self.gun_model_loaded,
            'gun_model_path': str(GUN_MODEL_PATH),
        }
