import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API } from '../api.js';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [file, setFile] = useState(null);
  const [camera, setCamera] = useState('BOP-01');
  const [night, setNight] = useState(false);
  const [sid, setSid] = useState(null);
  const [status, setStatus] = useState({});
  const [events, setEvents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState(true);
  const [notice, setNotice] = useState(null);
  const [alarmActive, setAlarmActive] = useState(false);

  const lastEventCount = useRef(0);
  const audioCtx = useRef(null);
  const sirenRef = useRef({ osc: null, gain: null });
  const alarmTimeout = useRef(null);

  const beep = useCallback((level = 'HIGH') => {
    if (!sound) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      const ctx = audioCtx.current || new C();
      audioCtx.current = ctx;
      const now = ctx.currentTime;
      const urgent = level === 'HIGH' || level === 'CRITICAL';
      const beeps = level === 'CRITICAL' ? [0, 0.16, 0.32, 0.48] : [0, 0.18, 0.36];
      beeps.forEach((d, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = urgent ? (i % 2 === 1 ? 1050 : 850) : 720;
        g.gain.setValueAtTime(0.0001, now + d);
        g.gain.exponentialRampToValueAtTime(0.22, now + d + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.13);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + d); o.stop(now + d + 0.15);
      });
    } catch (e) { /* audio not available - fail silently */ }
  }, [sound]);

  // Continuous siren loop while a CRITICAL (weapon) alert is active - mirrors a physical alarm
  // siren rather than a one-shot beep, matching the "Loud Alarm" concept from the reference design.
  const startSiren = useCallback(() => {
    if (!sound) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      if (sirenRef.current.osc) return; // already running
      const ctx = audioCtx.current || new C();
      audioCtx.current = ctx;
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 500;
      lfo.type = 'sine'; lfo.frequency.value = 2.2; lfoGain.gain.value = 220;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start(); lfo.start();
      sirenRef.current = { osc: o, gain: g, lfo };
    } catch (e) { /* audio not available */ }
  }, [sound]);

  const stopSiren = useCallback(() => {
    const { osc, lfo } = sirenRef.current;
    try { osc && osc.stop(); lfo && lfo.stop(); } catch (e) {}
    sirenRef.current = { osc: null, gain: null, lfo: null };
  }, []);

  useEffect(() => {
    if (!sid) return;
    const t = setInterval(async () => {
      try {
        const [st, evRes, an] = await Promise.all([
          fetch(`${API}/api/status/${sid}`).then(r => r.json()),
          fetch(`${API}/api/events/${sid}`).then(r => r.json()),
          fetch(`${API}/api/analytics/${sid}`).then(r => r.json()),
        ]);
        const ev = evRes.events || [];
        setStatus(st); setEvents(ev); setAnalytics(an);
        if (ev.length > lastEventCount.current) {
          const e = ev[ev.length - 1];
          setNotice(e); beep(e.level);
          setTimeout(() => setNotice(null), 5000);
          if (e.level === 'CRITICAL') {
            setAlarmActive(true); startSiren();
            clearTimeout(alarmTimeout.current);
            alarmTimeout.current = setTimeout(() => { setAlarmActive(false); stopSiren(); }, 12000);
          }
        }
        lastEventCount.current = ev.length;
      } catch (e) { /* backend momentarily unreachable - keep polling */ }
    }, 700);
    return () => clearInterval(t);
  }, [sid, sound, beep, startSiren, stopSiren]);

  async function start() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('video', file); fd.append('camera_id', camera); fd.append('night_mode', night);
      const r = await fetch(`${API}/api/session`, { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || 'Could not start session');
      setSid(d.session_id); setStatus(d); setEvents([]); setAnalytics(null); lastEventCount.current = 0;
    } catch (e) { alert(e.message); } finally { setLoading(false); }
  }

  async function control(action) {
    if (!sid) return;
    try {
      const st = await fetch(`${API}/api/control/${sid}?action=${action}`, { method: 'POST' }).then(r => r.json());
      setStatus(st);
      if (action === 'restart') lastEventCount.current = 0;
      if (action === 'stop') { setNotice(null); setAlarmActive(false); stopSiren(); }
    } catch (e) { alert('Control failed: ' + e.message); }
  }

  function testSound() {
    beep('HIGH');
    setNotice({ level: 'HIGH', title: 'TEST ALERT SIGNAL', reason: 'Operator test of audible alert system', camera, wall_time: new Date().toLocaleTimeString() });
    setTimeout(() => setNotice(null), 3500);
  }

  function dismissAlarm() { setAlarmActive(false); stopSiren(); }
  function dismissNotice() { setNotice(null); }

  function exportCSV() {
    if (!events.length) return alert('No incidents to export yet.');
    const head = 'ID,Level,Title,Camera,Video Time,Wall Time,Reason,Track ID\n';
    const rows = events.map(e => [e.id, e.level, e.title, e.camera, e.video_time, e.wall_time, e.reason, e.track_id ?? '']
      .map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([head + rows], { type: 'text/csv' }));
    a.download = `sentinel-ai-incidents-${camera}.csv`;
    a.click();
  }

  const value = {
    file, setFile, camera, setCamera, night, setNight, sid, status, events, analytics,
    loading, sound, setSound, notice, dismissNotice, alarmActive, dismissAlarm,
    start, control, testSound, exportCSV,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
