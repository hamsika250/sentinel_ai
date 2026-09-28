import React from 'react';
import { useSession } from '../context/SessionContext.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { API } from '../api.js';

export default function LiveFeed() {
  const { file, setFile, camera, setCamera, night, setNight, sid, status, events,
          loading, sound, setSound, notice, start, control, testSound, exportCSV } = useSession();

  const running = status.state === 'LIVE', paused = status.state === 'PAUSED';
  const latest = events.length ? events[events.length - 1] : null;
  const gallery = [...events].reverse().filter(e => e.snapshot).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div>
          <h2>Turn existing CCTV into intelligent surveillance.</h2>
          <p>Detection → tracking → behavior analysis → weapon &amp; suspicious-person flagging → incident fusion → explainable alerts.</p>
        </div>
        <div className="architecture"><b>CCTV</b>→<b>AI VISION</b>→<b>RISK ENGINE</b>→<b>ALERT</b></div>
      </section>

      <main className="livegrid">
        <aside className="panel setup">
          <h3>Camera Input</h3>
          <label>Camera ID</label>
          <select value={camera} onChange={e => setCamera(e.target.value)}>
            <option>BOP-01</option><option>BOP-02</option><option>BOP-03</option>
            <option>CHECKPOST-01</option><option>BORDER-ROAD-01</option>
          </select>
          <label>CCTV video</label>
          <input type="file" accept="video/*" onChange={e => setFile(e.target.files[0] || null)} />
          {file && <div className="filepill">✓ {file.name}</div>}
          <label className="check">
            <input type="checkbox" checked={night} onChange={e => setNight(e.target.checked)} /> Night surveillance mode
          </label>
          <button onClick={start} disabled={!file || loading}>{loading ? 'INITIALIZING AI…' : 'START ANALYTICS'}</button>
          <div className="controls">
            <button className="secondary" onClick={() => control('pause')} disabled={!sid || paused || status.state === 'STOPPED'}>⏸ PAUSE</button>
            <button className="secondary" onClick={() => control('resume')} disabled={!sid || !paused}>▶ RESUME</button>
            <button className="danger" onClick={() => control('stop')} disabled={!sid || status.state === 'STOPPED'}>⏹ STOP</button>
            <button className="secondary" onClick={() => control('restart')} disabled={!sid}>↻ RESTART</button>
          </div>
          <div className="soundrow">
            <button className={sound ? 'sound on' : 'sound'} onClick={() => setSound(!sound)}>{sound ? '🔊 SOUND ON' : '🔇 SOUND OFF'}</button>
            <button className="sound test" onClick={testSound}>♩ TEST ALERT</button>
          </div>
          <button className="export" onClick={exportCSV} disabled={!events.length}>⇩ EXPORT INCIDENT CSV</button>
          <div className="feature">
            ✓ Person detection + tracking<br />✓ Vehicle classification<br />✓ Weapon detection (knife + optional firearm model)<br />
            ✓ Suspicious-person behavior flagging<br />✓ Virtual fence intrusion<br />✓ Night / low-light enhancement (CLAHE)<br />
            ✓ Loitering heuristic<br />✓ Risk scoring + explainable alerts
          </div>
          {sid && !status.gun_model_loaded && (
            <div className="warnpill">⚠ Firearm model not loaded — knife detection active, gun detection needs weapon weights on the backend.</div>
          )}
        </aside>

        <section className="content">
          <div className="stats">
            <StatCard n={status.people_now || 0} t="PEOPLE NOW" />
            <StatCard n={status.vehicles_now || 0} t="VEHICLES NOW" />
            <StatCard n={status.weapons_now || 0} t="WEAPONS NOW" tone={status.weapons_now ? 'danger' : ''} />
            <StatCard n={status.suspicious_now || 0} t="SUSPICIOUS NOW" tone={status.suspicious_now ? 'warn' : ''} />
            <StatCard n={status.alerts || 0} t="INCIDENTS" />
            <StatCard n={`${status.risk || 0}%`} t="RISK SCORE" tone={status.risk >= 80 ? 'danger' : status.risk >= 40 ? 'warn' : ''} />
          </div>

          <div className="grid">
            <div className="panel video">
              <div className="panelhead"><h3>Live Analysis View</h3><span>{sid ? (status.state || 'LIVE') : 'WAITING FOR INPUT'}</span></div>
              {sid ? (
                <>
                  <img src={`${API}/api/stream/${sid}`} alt="Live CCTV analytics" />
                  <div className="videobar">
                    <span>Camera: <b>{camera}</b></span><span>Frame: <b>{status.frame || 0}</b></span>
                    <span>Peak P: <b>{status.peak_people || 0}</b></span><span>Peak V: <b>{status.peak_vehicles || 0}</b></span>
                    <span>Peak W: <b>{status.peak_weapons || 0}</b></span>
                  </div>
                </>
              ) : (
                <div className="placeholder"><strong>SENTINEL AI VIDEO ANALYTICS</strong><span>Load a CCTV video to begin detection</span></div>
              )}
            </div>

            <div className="panel detectinfo">
              <div className="panelhead"><h3>Latest Detection</h3><span>ZONE • TIME • RISK</span></div>
              {latest ? (
                <div className={`detectbody level-${latest.level.toLowerCase()}`}>
                  <b>{latest.title}</b>
                  <div className="detectrow"><span>Zone</span><b>{latest.reason.toLowerCase().includes('restricted') ? 'Restricted Zone' : 'Monitored Area'}</b></div>
                  <div className="detectrow"><span>Time</span><b>{latest.wall_time}</b></div>
                  <div className="detectrow"><span>Camera</span><b>{latest.camera}</b></div>
                  <div className="detectrow"><span>Track</span><b>{latest.track_id ?? '—'}</b></div>
                  <p>{latest.reason}</p>
                </div>
              ) : <div className="empty">No detections yet.</div>}
            </div>
          </div>

          <div className="grid">
            <div className="panel gallery">
              <div className="panelhead"><h3>Captured Evidence</h3><span>{gallery.length} IMAGES</span></div>
              {gallery.length === 0 ? <div className="empty">Evidence thumbnails appear here when an incident fires.</div> : (
                <div className="thumbrow">
                  {gallery.map(e => (
                    <div key={e.id} className={`thumb level-${e.level.toLowerCase()}`}>
                      <img src={e.snapshot} alt={e.title} />
                      <small>{e.title}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel alerts">
              <div className="panelhead"><h3>Alert Center</h3><span>{events.length} EVENTS</span></div>
              {events.length === 0 ? <div className="empty">No incidents detected yet.</div> : (
                [...events].reverse().slice(0, 8).map(e => (
                  <div className={`event ${e.level.toLowerCase()}`} key={e.id}>
                    <div className="eventtop"><b>{e.title}</b><small>{e.wall_time}</small></div>
                    <p>{e.reason}</p>
                    <small>{e.camera} • video {e.video_time}s • Track {e.track_id ?? '—'}</small>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel timeline">
            <div className="panelhead"><h3>Incident Intelligence Pipeline</h3><span>EXPLAINABLE EVENT LOG</span></div>
            <div className="logic">
              <Box n="1" t="Live CCTV Feed" d="Existing camera captures live video" />
              <i>→</i>
              <Box n="2" t="Alert Zone Entry" d="AI detects a person / vehicle / weapon in the zone" />
              <i>→</i>
              <Box n="3" t="Photo Capture" d="Evidence snapshot auto-captured" />
              <i>→</i>
              <Box n="4" t="Loud Alarm" d="Siren + on-screen alert for critical events" />
              <i>→</i>
              <Box n="5" t="Report to Officers" d="Alert with location, time, risk level" />
              <i>→</i>
              <Box n="6" t="Decision & Action" d="Authorized operator verifies and acts" />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

const Box = ({ n, t, d }) => (
  <div className="logicbox"><span className="logicnum">{n}</span><b>{t}</b><span>{d}</span></div>
);
