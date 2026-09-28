import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { useSession } from '../context/SessionContext.jsx';
import { StatCard } from '../components/StatCard.jsx';

const LEVEL_COLORS = { CRITICAL: '#ff1f3d', HIGH: '#ff5364', MEDIUM: '#e9ad52', LOW: '#4d9ab4' };

export default function Dashboard() {
  const { sid, status, analytics } = useSession();

  if (!sid) {
    return (
      <main className="page">
        <div className="panel"><div className="empty">Start an analytics session on the Live Feed page to see charts here.</div></div>
      </main>
    );
  }

  const riskHistory = (analytics?.risk_history || []).map(p => ({ time: `${p.t}s`, risk: p.risk }));
  const typeBreakdown = Object.entries(analytics?.breakdown_by_type || {}).map(([name, value]) => ({ name, value }));
  const levelBreakdown = Object.entries(analytics?.breakdown_by_level || {}).map(([name, value]) => ({ name, value }));

  return (
    <main className="page">
      <h2 className="pagetitle">Analytics Dashboard <small>{status.camera} • {status.state}</small></h2>

      <div className="stats">
        <StatCard n={analytics?.totals?.peak_people ?? 0} t="PEAK PEOPLE" />
        <StatCard n={analytics?.totals?.peak_vehicles ?? 0} t="PEAK VEHICLES" />
        <StatCard n={analytics?.totals?.peak_weapons ?? 0} t="PEAK WEAPONS" tone={analytics?.totals?.peak_weapons ? 'danger' : ''} />
        <StatCard n={analytics?.totals?.alerts ?? 0} t="TOTAL INCIDENTS" />
        <StatCard n={`${analytics?.totals?.risk ?? 0}%`} t="CURRENT RISK" />
      </div>

      <div className="chartgrid">
        <div className="panel chartpanel">
          <div className="panelhead"><h3>Risk Score Over Time</h3><span>LIVE RISK TREND</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={riskHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2c3a" />
              <XAxis dataKey="time" stroke="#6f8797" fontSize={10} />
              <YAxis domain={[0, 100]} stroke="#6f8797" fontSize={10} />
              <Tooltip contentStyle={{ background: '#0a151f', border: '1px solid #203140' }} />
              <Line type="monotone" dataKey="risk" stroke="#ff5364" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chartpanel">
          <div className="panelhead"><h3>Incidents by Type</h3><span>EVENT BREAKDOWN</span></div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={typeBreakdown} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2c3a" />
              <XAxis type="number" stroke="#6f8797" fontSize={10} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="#6f8797" fontSize={9} width={140} />
              <Tooltip contentStyle={{ background: '#0a151f', border: '1px solid #203140' }} />
              <Bar dataKey="value" fill="#2e9fc0" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chartpanel">
          <div className="panelhead"><h3>Severity Distribution</h3><span>ALERT LEVELS</span></div>
          {levelBreakdown.length === 0 ? <div className="empty">No incidents yet.</div> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={levelBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {levelBreakdown.map((entry, i) => <Cell key={i} fill={LEVEL_COLORS[entry.name] || '#547080'} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: '#0a151f', border: '1px solid #203140' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {!analytics?.gun_model_loaded && (
        <div className="warnpill" style={{ marginTop: 16 }}>
          ⚠ Firearm detection model not loaded on the backend — the charts above reflect knife-based
          weapon detection only until weapon weights are supplied.
        </div>
      )}
    </main>
  );
}
