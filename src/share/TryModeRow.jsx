// TryModeRow.jsx — the SECOND row on every end screen (feat/solo-endgame).
//
// Every game-over used to point back at itself: REMATCH / RESTART / PLAY AGAIN and nothing else.
// This adds one ghost button naming a DIFFERENT unlocked mode — the one the player has played
// least (see progress/nextMode.js) — so the end of a run is a fork rather than a loop.
//
// Renders NOTHING when there is no honest suggestion (every other mode still locked, which is the
// normal state for a new account), so it can be mounted unconditionally on every screen.
//
// Navigation is a real page load. The app's entry-param readers (LAUNCH_INTENT, solo/config,
// satRush/config) all resolve ONCE at import time, so a pushState would change the URL without
// opening the mode; assign() re-boots through router.bridgePathToSearch and lands in the mode.
// A finished game is exactly the moment where a full navigation is free.
import { pickTryMode } from '../progress/nextMode.js';
import { GAMES } from '../gameData.js';
import { loadProgress } from '../progress/xp';
import { allMasteryStates } from '../progress/mastery';
import { track } from '../lib/analytics';
import './TryModeRow.css';

/** Per-mode play counts from the mastery track (cumulative accepted words per mode). */
function readCounts() {
  try {
    const states = allMasteryStates() || {};
    const out = {};
    for (const id of Object.keys(states)) {
      const st = states[id];
      out[id] = st && Number.isFinite(st.words) ? st.words : 0;
    }
    return out;
  } catch {
    return {}; // blocked storage — everything reads as 0, the tie-break still gives a suggestion
  }
}

export default function TryModeRow({ current, className = '' }) {
  let level = 1;
  try {
    level = loadProgress().level;
  } catch {
    /* blocked storage — treat as LV1, which simply hides the level-gated modes */
  }

  const pick = pickTryMode({ current, level, counts: readCounts(), games: GAMES });
  if (!pick) return null; // nothing unlocked to offer — no orphan row

  function onClick() {
    try { track('try_mode_clicked', { from: current, to: pick.id }); } catch { /* analytics only */ }
    window.location.assign(pick.path);
  }

  return (
    <div className={`try-mode-row${className ? ` ${className}` : ''}`}>
      <button type="button" className="try-mode-btn" onClick={onClick}>
        {`TRY ${pick.name}`}
      </button>
    </div>
  );
}
