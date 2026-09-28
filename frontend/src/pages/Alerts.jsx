import React, { useMemo, useState } from 'react';
import { useSession } from '../context/SessionContext.jsx';

const LEVELS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'];

export default function Alerts() {
  const { sid, events, exportCSV } = useSession();
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const list = [...events].reverse();
    return filter === 'ALL' ? list : list.filter(e => e.level === filter);
  }, [events, filter]);

  if (!sid) {
    return (
      <main className="page">
        <div className="panel"><div className="empty">Start an analytics session on the Live Feed page to see the incident report here.</div></div>
      </main>
    );
  }

  return (
    <main className="page">
      <h2 className="pagetitle">Alert &amp; Incident Reports <small>{events.length} total events</small></h2>

      <div className="alertsbar">
        <div className="filterrow">
          {LEVELS.map(l => (
            <button key={l} className={`chip ${filter === l ? 'active' : ''} chip-${l.toLowerCase()}`} onClick={() => setFilter(l)}>{l}</button>
          ))}
        </div>
        <button className="export" onClick={exportCSV} disabled={!events.length}>⇩ EXPORT INCIDENT CSV</button>
      </div>

      <div className="reportgrid">
        <div className="panel reportlist">
          {filtered.length === 0 ? <div className="empty">No incidents match this filter.</div> : filtered.map(e => (
            <div key={e.id} className={`event clickable ${e.level.toLowerCase()} ${selected?.id === e.id ? 'selected' : ''}`} onClick={() => setSelected(e)}>
              <div className="eventtop"><b>{e.title}</b><small>{e.wall_time}</small></div>
              <p>{e.reason}</p>
              <small>{e.camera} • video {e.video_time}s • Track {e.track_id ?? '—'}</small>
            </div>
          ))}
        </div>

        <div className="panel reportdetail">
          <div className="panelhead"><h3>Officer Report</h3><span>{selected ? `#${selected.id}` : 'SELECT AN INCIDENT'}</span></div>
          {!selected ? <div className="empty">Click an incident on the left to view its full report and evidence image.</div> : (
            <div className="reportbody">
              {selected.snapshot && <img src={selected.snapshot} alt={selected.title} className="reportimg" />}
              <table>
                <tbody>
                  <tr><td>Title</td><td>{selected.title}</td></tr>
                  <tr><td>Severity</td><td><span className={`levelbadge ${selected.level.toLowerCase()}`}>{selected.level}</span></td></tr>
                  <tr><td>Camera</td><td>{selected.camera}</td></tr>
                  <tr><td>Time</td><td>{selected.wall_time} (video {selected.video_time}s)</td></tr>
                  <tr><td>Track ID</td><td>{selected.track_id ?? '—'}</td></tr>
                  <tr><td>Details</td><td>{selected.reason}</td></tr>
                </tbody>
              </table>
              <p className="reportnote">Decision & action rests with the authorized operator reviewing this report — Sentinel AI surfaces evidence, it does not act autonomously.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
