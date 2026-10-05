// LiveTicker — STEP 51: "ZED just hit LV 50" in the menu's footer row (it JOINS the footer —
// CLAUDE.md NO ORPHAN FIXED UI). Empty at rest: a moment from another player shows for 6 s and steps
// back. One line, never wraps, nothing loops at rest. (Andy Oct 2: the "N ONLINE" count is gone.)
import { useEffect, useState } from 'react';
import { subscribeLive } from './live.js';
import { LEADERBOARD_ENABLED } from './client.js';
import { tickParts } from './tickText.js';
import { rarityClass } from '../lib/rarityStyle.js';
import RarityFx from '../components/rarity/RarityFx';
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
  const parts = LEADERBOARD_ENABLED && tick ? tickParts(tick) : null;
  if (!parts) return null;
  return (
    <span className={`live-ticker ${className}`} aria-live="polite">
      <span key={tick.key} className="live-tick">
        {parts.lead}
        {/* RARITY IDENTITY (Andy oct5): the tier wears its fill, glow and shimmer — one sweep as the line lands */}
        {parts.tag ? (
          parts.rarity ? (
            <span className={`live-tick-tag rarity-chip ${rarityClass(parts.rarity)}`}>
              {parts.tag}
              <RarityFx tier={parts.rarity} particles={false} delay={200} />
            </span>
          ) : parts.tag
        ) : null}
      </span>
    </span>
  );
}
