# Sentinel AI — SIH26187
## AI-Powered Border Security Analytics Platform

Hackathon prototype for AI-based border CCTV analytics using existing camera/video infrastructure.

### Structure (multi-page app)
The frontend now mirrors a standard product layout (nav bar + separate pages) instead of one long
scrolling page:

| Page | Route | What it shows |
|---|---|---|
| Live Feed | `/` | Camera input, live annotated video stream, latest-detection panel, captured evidence thumbnails, alert center, 6-step incident pipeline |
| Dashboard | `/dashboard` | Risk-score trend line, incidents-by-type bar chart, severity pie chart, peak counts |
| Alerts | `/alerts` | Filterable incident log with a click-through officer report + evidence image per incident, CSV export |
| Sensors | `/sensors` | Live-polled status grid for cameras, UAV, ground motion/seismic sensors and the uplink radio |

### Features
- Person and vehicle detection with YOLO, with lightweight object tracking
- **Weapon detection** — edged weapons (knife) out of the box via the base model's COCO class;
  firearms via an optional second, separately trained detection model (see below)
- **Suspicious-person flagging** — composite behavioural signal (loitering + restricted-zone
  presence or low-light concealment) raises a distinct "SUSPICIOUS PERSON DETECTED" alert, not
  just a generic loitering note
- Virtual-fence intrusion alerts
- **Night/low-light enhancement** — CLAHE-based local contrast boost run on dim frames before
  detection, genuinely improving detection in low light (labelled honestly as software
  enhancement, not a claim of thermal/IR hardware we don't have)
- Loitering heuristic
- **Evidence capture** — an annotated snapshot is auto-attached to every incident event, shown as
  thumbnails on Live Feed and as full images in the Alerts report view
- CRITICAL severity for weapon alerts: persistent on-screen alarm banner + continuous siren tone
  (not just a single beep) until an operator acknowledges it — human-in-the-loop by design
- Risk scoring, with a time-series history exposed for the dashboard trend chart
- Session controls: pause / resume / stop / restart
- **Sensor monitoring** — status grid for cameras, a patrol UAV, ground motion/seismic sensors and
  the command-post uplink (battery, signal, last heartbeat)
- Explainable incident events, CSV export
- Architecture ready for RTSP camera input

> Prototype only: rules, risk scores, and sensor telemetry are demonstration heuristics /
> simulated data, not validated security models or live hardware feeds. Every simulated or
> not-yet-active capability is labelled as such in the UI rather than presented as real.

### Enabling firearm detection
The base `yolo11n.pt` model is trained on COCO, which has a `knife` class but no gun/rifle/pistol
class, so out of the box this prototype detects edged weapons but not firearms. To turn on firearm
detection:
1. Obtain or train a YOLO-format weapon-detection model (`.pt` weights) for guns/rifles/pistols.
2. Place it at `backend/weights/gun_detector.pt` (or point `GUN_MODEL_PATH` at another location).
3. Restart the backend — `/api/status/{sid}` and `/api/analytics/{sid}` will report
   `gun_model_loaded: true` once it's picked up, and the UI's warning banner disappears.

Without those weights, the UI shows a banner noting that firearm detection is inactive, and only
knife detection + the rest of the pipeline runs.

### Sensor monitoring
`backend/sensors.py` produces clearly-labelled **simulated** telemetry for a representative sensor
layout (4 cameras, 1 UAV, 2 ground motion sensors, 1 seismic sensor, 1 uplink radio) because no
physical hardware is wired into this hackathon prototype. The response shape (`id`, `type`,
`status`, `battery`, `signal`, `last_heartbeat_seconds_ago`) matches what a real MQTT/REST sensor
gateway would return, so swapping in real hardware later is a drop-in replacement for that one
module — the API route and frontend don't need to change.

## Run backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

## Run frontend
```bash
cd frontend
npm install
npm run dev
```
Then open the Vite URL, normally http://localhost:5173.

The first backend run may download the small `yolo11n.pt` model automatically.
