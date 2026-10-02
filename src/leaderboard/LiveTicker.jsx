// LiveTicker — STEP 51: "ZED just hit LV 50" in the menu's footer row (it JOINS the footer —
// CLAUDE.md NO ORPHAN FIXED UI). Empty at rest: a moment from another player shows for 6 s and steps
// back. One line, never wraps, nothing loops at rest. (Andy Oct 2: the "N ONLINE" count is gone.)
import { useEffect, useState } from 'react';
import { subscribeLive } from './live.js';
import { LEADERBOARD_ENABLED } from './client.js';
import { tickText } from './tickText.js';
import './LiveTicker.css';

const SHOW_MS = 6000;


export default function LiveTicker({ className = '' }) {
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (!LEADERBOARD_ENABLED) return undefined;
    let timer = null;
    const off = subscribeLive((e) => {
      if (e.type === 'tick') {
        setTick({ ...e.tick, key: Date.now() });
        clearTimeout(timer);
        timer = setTimeout(() => setTick(null), SHOW_MS);
      }
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);
  if (!LEADERBOARD_ENABLED || !tick) return null;
  return (
    <span className={`live-ticker ${className}`} aria-live="polite">
      <span key={tick.key} className="live-tick">
        {tickText(tick)}
      </span>
    </span>
  );
}
