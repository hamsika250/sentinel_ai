"""
Sensor-monitoring layer for Sentinel AI.

There is no physical hardware wired into this hackathon prototype, so this module produces
clearly-labelled SIMULATED telemetry (battery drain, signal jitter, occasional dropouts) for a
representative set of border-post sensors: CCTV nodes, a UAV, ground motion/seismic sensors and
an uplink radio. The shape of the data (id, type, status, battery, signal, last_seen) is what a
real MQTT/REST sensor-gateway integration would return, so swapping this module for a real
gateway client later does not require changing the API contract or the frontend.
"""
import time, random

_RNG_SEED_BASE = 42
_START = time.time()

SENSOR_DEFS = [
    {'id': 'CAM-BOP-01', 'type': 'camera', 'label': 'CCTV - Border Outpost 01', 'zone': 'Sector A'},
    {'id': 'CAM-BOP-02', 'type': 'camera', 'label': 'CCTV - Border Outpost 02', 'zone': 'Sector A'},
    {'id': 'CAM-CHECKPOST-01', 'type': 'camera', 'label': 'CCTV - Checkpost 01', 'zone': 'Sector B'},
    {'id': 'CAM-BORDER-ROAD-01', 'type': 'camera', 'label': 'CCTV - Border Road 01', 'zone': 'Sector B'},
    {'id': 'UAV-01', 'type': 'drone', 'label': 'Patrol UAV Sentinel-1', 'zone': 'Airborne'},
    {'id': 'PIR-01', 'type': 'motion', 'label': 'Ground Motion Sensor 01', 'zone': 'Sector A Fenceline'},
    {'id': 'PIR-02', 'type': 'motion', 'label': 'Ground Motion Sensor 02', 'zone': 'Sector B Fenceline'},
    {'id': 'SEIS-01', 'type': 'seismic', 'label': 'Seismic Intrusion Sensor 01', 'zone': 'Sector A Fenceline'},
    {'id': 'UPLINK-01', 'type': 'network', 'label': 'Command-Post Uplink Radio', 'zone': 'Base Station'},
]


def _pseudo_random(sensor_id, salt):
    """Deterministic-but-drifting pseudo-random value in [0,1), seeded by sensor id + elapsed time,
    so repeated polls look like a live, slowly-changing feed rather than pure noise."""
    r = random.Random(f'{sensor_id}-{salt}-{int((time.time() - _START) // 6)}')
    return r.random()


def get_sensors():
    sensors = []
    online_count = 0
    for d in SENSOR_DEFS:
        drop_roll = _pseudo_random(d['id'], 'drop')
        degraded_roll = _pseudo_random(d['id'], 'deg')
        status = 'ONLINE'
        if drop_roll < 0.04:
            status = 'OFFLINE'
        elif degraded_roll < 0.12:
            status = 'DEGRADED'
        else:
            online_count += 1

        battery = None
        if d['type'] in ('drone', 'motion', 'seismic'):
            battery = int(35 + 60 * _pseudo_random(d['id'], 'batt'))
        signal = int(40 + 60 * _pseudo_random(d['id'], 'sig')) if status != 'OFFLINE' else 0
        heartbeat_s = int(1 + 25 * _pseudo_random(d['id'], 'hb')) if status != 'OFFLINE' else int(60 + 500 * _pseudo_random(d['id'], 'hb2'))

        sensors.append({
            **d, 'status': status, 'battery': battery, 'signal': signal,
            'last_heartbeat_seconds_ago': heartbeat_s,
        })
    return {
        'sensors': sensors,
        'summary': {
            'total': len(sensors),
            'online': sum(1 for s in sensors if s['status'] == 'ONLINE'),
            'degraded': sum(1 for s in sensors if s['status'] == 'DEGRADED'),
            'offline': sum(1 for s in sensors if s['status'] == 'OFFLINE'),
        },
        'simulated': True,
        'note': 'Simulated telemetry for demo purposes. Point this module at a real MQTT/REST '
                'sensor gateway to serve live hardware readings with the same response shape.',
    }
