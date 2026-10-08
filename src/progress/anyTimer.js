// anyTimer.js — "is ANY boost running right now?", and nothing else.
//
// This is the one piece of the BOOST DOCK that has to be eager: App.jsx must know whether to mount the dock
// before it can decide to load it. It deliberately does NOT import liveTimers.js — that module carries the row
// table (names, colours, the "what it boosts" wording) and rides the dock's own lazy chunk, so a visitor with
// no boost running never downloads a byte of it (payload ratchet, e2e/payload-budget.spec.js).
//
// Every import here is already in the eager bundle (the payout stack reads all of them per word).
import { boostRemaining } from './boost.js';
import { overdriveRemaining } from './overdrive.js';
import { frenzyRemaining } from './frenzy.js';
import { V3 } from './season.js';

const fx = (kind, now) => {
  try {
    return V3.stock ? V3.stock.stockFxLeft(kind, now) : 0;
  } catch {
    return 0;
  }
};

/** ms until the LAST running boost ends (0 when none). */
export function anyTimerRemaining(now = Date.now()) {
  return Math.max(
    overdriveRemaining(now),
    boostRemaining(now),
    frenzyRemaining(now),
    fx('xp', now),
    fx('wins', now),
    fx('luck', now),
  );
}
