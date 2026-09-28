import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../context/SessionContext.jsx';

export default function Navbar() {
  const { sid, status } = useSession();
  const link = ({ isActive }) => 'navlink' + (isActive ? ' active' : '');
  return (
    <header className="topbar">
      <div className="brand">
        <span className="dot" /> Sentinel AI
        <small>AI-Powered Border Security Analytics Platform</small>
      </div>
      <nav className="navlinks">
        <NavLink to="/" end className={link}>Live Feed</NavLink>
        <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
        <NavLink to="/alerts" className={link}>Alerts</NavLink>
        <NavLink to="/sensors" className={link}>Sensors</NavLink>
      </nav>
      <div className="topbar-right">
        {sid && <span className={`sessionpill ${status.state === 'LIVE' ? 'live' : ''}`}>{status.state || 'READY'} • {status.camera}</span>}
        <span className="online">● AI ENGINE ONLINE</span>
      </div>
    </header>
  );
}
