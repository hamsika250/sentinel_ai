import React from 'react';
import { useSession } from '../context/SessionContext.jsx';

// Persistent, full-width red banner shown across every page while a CRITICAL (weapon) alert is
// active - the "Loud Alarm" concept from the reference design, plus a dismiss so the operator
// stays in control of when it clears (never auto-hidden without an explicit human-in-the-loop ack).
export default function AlarmBanner() {
  const { alarmActive, dismissAlarm, notice } = useSession();
  if (!alarmActive) return null;
  return (
    <div className="alarmbanner">
      <div className="alarmicon">⚠</div>
      <div className="alarmtext">
        <b>LOUD ALARM — WEAPON DETECTED</b>
        <span>{notice?.reason || 'A weapon was identified by the AI engine. Immediate operator verification required.'}</span>
      </div>
      <button onClick={dismissAlarm}>ACKNOWLEDGE</button>
    </div>
  );
}
