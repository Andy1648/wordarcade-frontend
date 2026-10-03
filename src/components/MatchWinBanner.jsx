// MatchWinBanner.jsx — less-is-more (Andy oct3): "In MULTIPLAYER only, show the winner multiplier
// once at the START of the round (a short banner), nowhere else."
//
// The ONE place the match-win multiplier is announced before a game (the mode cards and dialogs no
// longer print it; the end-of-game receipt still states what was actually paid). Rendered by the
// screen that owns the round start — inside GameScreen's 3-2-1 countdown overlay and inside WORD
// RACE's countdown hero — as a position:absolute, pointer-events:none child of that existing
// layout, never a new position:fixed element.
//
// The caller decides WHEN (round start) and WHETHER (≥1 human rival — a bot-only room never pays
// the match bonus, payout.js winnerPayout → 'bots'). The multiplier is payout.js's WINNER_MATCH via
// winnerMatchMult, the same source the payout reads, so the banner cannot quote a different number.
//
// MOTION: one finite 1.5 s keyframe (pop in, hold, fade out; transform/opacity only), then it
// unmounts. REDUCED MOTION: static for the same 1.5 s, then unmounts. Nothing loops.
import { useEffect, useState } from 'react';
import { winnerMatchMult } from '../progress/payout';
import { formatMultExact } from '../format';
import './MatchWinBanner.css';

export const MATCH_BANNER_MS = 1500;

/** Is there at least one HUMAN rival in this roster? `players` = [{ id, isBot }]. */
export function hasHumanRival(players, myId) {
  return Array.isArray(players) && players.some((p) => p && p.id != null && p.id !== myId && !p.isBot);
}

export default function MatchWinBanner({ mode }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setGone(true), MATCH_BANNER_MS);
    return () => clearTimeout(id);
  }, []);
  const mult = winnerMatchMult(mode);
  if (gone || !(mult > 1)) return null;
  return (
    <div className="match-win-banner-slot" aria-hidden="true">
      <div className="match-win-banner" data-match-win-banner={mult}>
        WIN = ×{formatMultExact(mult)} YOUR GAME
      </div>
    </div>
  );
}
