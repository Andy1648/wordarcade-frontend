// DevResetNotice — 012_admin_reset: the one line a player sees after the dev reset their progress
// (profiles.reset_all). Shown once, on the menu the reset reloaded into; obeyDevReset leaves the notice
// in storage and Homepage reads-and-clears it. Same shape as RankUpMoment: one finite card,
// pointer-events:none so it never blocks the menu, a status line for screen readers.
import { useEffect, useRef } from 'react';
import './DevResetNotice.css';

export const DEV_RESET_NOTICE_MS = 3600;

export default function DevResetNotice({ onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current && doneRef.current(), DEV_RESET_NOTICE_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="dev-reset-layer">
      <p className="dev-reset-card" role="status">YOUR PROGRESS WAS RESET BY THE DEV.</p>
    </div>
  );
}
