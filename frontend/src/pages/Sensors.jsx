import React, { useEffect, useState } from 'react';
import { getJSON } from '../api.js';

const ICONS = { camera: '📷', drone: '🚁', motion: '📡', seismic: '🌐', network: '📶' };

export default function Sensors() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const d = await getJSON('/api/sensors');
        if (alive) { setData(d); setError(null); }
      } catch (e) { if (alive) setError('Could not reach the sensor gateway.'); }
    }
    poll();
    const t = setInterval(poll, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <main className="page">
      <h2 className="pagetitle">Sensor Monitoring <small>Cameras • UAV • ground sensors • uplink</small></h2>

      {data?.simulated && (
        <div className="warnpill">
          ⚠ {data.note}
        </div>
      )}
      {error && <div className="warnpill">⚠ {error}</div>}

      {data && (
        <div className="stats">
          <div className="stat"><strong>{data.summary.online}</strong><span>ONLINE</span></div>
          <div className="stat warn"><strong>{data.summary.degraded}</strong><span>DEGRADED</span></div>
          <div className="stat danger"><strong>{data.summary.offline}</strong><span>OFFLINE</span></div>
          <div className="stat"><strong>{data.summary.total}</strong><span>TOTAL SENSORS</span></div>
        </div>
      )}

      <div className="sensorgrid">
        {(data?.sensors || []).map(s => (
          <div key={s.id} className={`sensorcard status-${s.status.toLowerCase()}`}>
            <div className="sensortop">
              <span className="sensoricon">{ICONS[s.type] || '📟'}</span>
              <span className={`statusdot ${s.status.toLowerCase()}`} />
            </div>
            <b>{s.label}</b>
            <small>{s.id} • {s.zone}</small>
            <div className="sensormeta">
              <span className={`sensorstatus ${s.status.toLowerCase()}`}>{s.status}</span>
              {s.battery !== null && <span>🔋 {s.battery}%</span>}
              <span>📶 {s.signal}%</span>
            </div>
            <div className="heartbeat">
              last heartbeat {s.last_heartbeat_seconds_ago < 60 ? `${s.last_heartbeat_seconds_ago}s ago` : `${Math.round(s.last_heartbeat_seconds_ago / 60)}m ago`}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
