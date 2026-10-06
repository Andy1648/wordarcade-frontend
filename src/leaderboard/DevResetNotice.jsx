// DevResetNotice — 012_admin_reset: the one line a player sees after the dev reset their progress
// (profiles.reset_all). Shown once, on the menu the reset reloaded into; obeyDevReset leaves the notice
// in storage and Homepage reads-and-clears it. Same shape as RankUpMoment: one finite card,
// pointer-events:none so it never blocks the menu, a status line for screen readers.
import { useEffect, useRef } from 'react';
import { SEASON2, V3 } from '../progress/season.js'; // P7: V3.toast = the kit's right-edge toast (v3 chunk)
import './DevResetNotice.css';

export const DEV_RESET_NOTICE_MS = 3600;

export default function DevResetNotice({ onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const sentRef = useRef(false);
  useEffect(() => {
    // P7 POPUP PURGE (SEASON2 only): the line is a right-edge toast, never over the menu's centre.
    if (SEASON2) {
      if (sentRef.current) return undefined; // once per mount (StrictMode re-runs effects in dev)
      sentRef.current = true;
      V3.toast({ head: 'PROGRESS RESET', label: 'BY THE DEV', icon: 'settings', tile: '#FFFFFF' });
      if (doneRef.current) doneRef.current();
      return undefined;
    }
    const t = setTimeout(() => doneRef.current && doneRef.current(), DEV_RESET_NOTICE_MS);
    return () => clearTimeout(t);
  }, []);
  if (SEASON2) return null;
  return (
    <div className="dev-reset-layer">
      <p className="dev-reset-card" role="status">YOUR PROGRESS WAS RESET BY THE DEV.</p>
    </div>
  );
}
