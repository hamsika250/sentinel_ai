import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import AlarmBanner from './components/AlarmBanner.jsx';
import LiveFeed from './pages/LiveFeed.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Alerts from './pages/Alerts.jsx';
import Sensors from './pages/Sensors.jsx';
import { useSession } from './context/SessionContext.jsx';

export default function App() {
  const { notice, dismissNotice } = useSession();
  return (
    <div className="app">
      <Navbar />
      <AlarmBanner />
      <Routes>
        <Route path="/" element={<LiveFeed />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/sensors" element={<Sensors />} />
      </Routes>
      {notice && (
        <div className={`toast ${notice.level?.toLowerCase() || 'high'}`}>
          <div className="toasticon">!</div>
          <div><b>🚨 {notice.title}</b><span>{notice.reason}</span></div>
          <button onClick={dismissNotice}>×</button>
        </div>
      )}
    </div>
  );
}
