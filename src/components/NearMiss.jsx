// NearMiss — EXTENSION b (extensions-spec): ONE big tappable line on an end screen, "38 LETTERS TO
// LV 41", shown only when one more run plausibly gets the goal (progress/nearMiss.js decides). DORMANT
// behind flagOn('nearmiss') (?nearmiss=1 / localStorage taw.flag.nearmiss='1').
//
// It sits in the ClaimPrompt slot, mounted straight AFTER <ClaimPrompt/>; NearMiss.css hides it while
// the claim prompt is on screen (`.lb-cp ~ .nm-line`), so an end screen only ever carries one big
// nudge. The line IS the play-again: tapping it calls the screen's existing PLAY AGAIN / RESTART
// handler — no new action. The line is computed ONCE on mount (the run is over; nothing changes).
import { useState } from 'react';
import { flagOn } from '../lib/featureFlags';
import { nearMissNow } from '../progress/nearMissData';
import './NearMiss.css';
import { SEASON2 } from '../progress/season';

// P7 POPUP PURGE (SEASON2 only): no near-miss sticker on the end screen — the XP bar shows how close the next level is. Flag OFF: unchanged.
export default function NearMiss(props) {
  return SEASON2 ? null : <NearMissLive {...props} />;
}

function NearMissLive({ mode, onPlay, disabled = false, look }) {
  const [line] = useState(() => (flagOn('nearmiss') ? nearMissNow(mode) : null));
  if (!line) return null;
  return (
    <button
      type="button"
      className={`nm-line${look ? ` is-${look}` : ''}`}
      data-goal={line.kind}
      onClick={onPlay}
      disabled={disabled}
      aria-label={`${line.text} — play again`}
    >
      {line.text}
    </button>
  );
}
