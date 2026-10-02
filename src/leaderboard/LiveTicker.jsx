// LiveTicker — STEP 51: "● 12 ONLINE · ZED just hit LV 50" in the menu's footer row (it JOINS the
// footer — CLAUDE.md NO ORPHAN FIXED UI). Quiet by default: the online count alone; a moment from
// another player shows for 6 s and steps back. One line, never wraps, nothing loops at rest.
import { useEffect, useState } from 'react';
import { subscribeLive } from './live.js';
import { LEADERBOARD_ENABLED } from './client.js';
import { tickText } from './tickText.js';
import './LiveTicker.css';

const SHOW_MS = 6000;


export default function LiveTicker({ className = '' }) {
  const [online, setOnline] = useState(0);
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (!LEADERBOARD_ENABLED) return undefined;
    let timer = null;
    const off = subscribeLive((e) => {
      if (e.type === 'online') setOnline(e.online);
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
  if (!LEADERBOARD_ENABLED || (!online && !tick)) return null;
  return (
    <span className={`live-ticker ${className}`} aria-live="polite">
      {online > 0 && (
        <span className="live-online">
          <span className="live-dot" aria-hidden="true" />
          {online} ONLINE
        </span>
      )}
      {tick && (
        <span key={tick.key} className="live-tick">
          {' · '}
          {tickText(tick)}
        </span>
      )}
    </span>
  );
}
