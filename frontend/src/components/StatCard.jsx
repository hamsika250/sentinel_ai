import React from 'react';

export function StatCard({ n, t, tone }) {
  return (
    <div className={`stat ${tone || ''}`}>
      <strong>{n}</strong>
      <span>{t}</span>
    </div>
  );
}
