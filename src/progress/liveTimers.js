// liveTimers.js — EVERY running boost, as one list, for the corner BOOST DOCK and the STATS BOOSTS panel.
//
// ANDY (R5 oct8): "when boosts are active they should have a timer at the bottom right of the screen instead of
// dead center … things like this should say — boost WHAT?" So each row carries not just a clock but the NAME of
// what it multiplies — the dock is the one place a player can read every live effect at once.
//
// PURE + guarded: every source already guards its own storage, and the v3 STOCK effects are read through the V3
// holder (season.js) so this module never pulls the v3 chunk into the eager bundle (payload ratchet).
import { boostRemaining, codeBoostMult } from './boost.js';
import { overdriveRemaining, OVERDRIVE_MULT } from './overdrive.js';
import { frenzyRemaining, FRENZY_MULT } from './frenzy.js';
import { V3 } from './season.js';

// tone = the house colour the row wears; `says` answers "boost WHAT?" in one phrase.
const ROWS = [
  {
    id: 'overdrive',
    name: 'OVERDRIVE',
    says: 'WINS + XP',
    tone: '#FF4FA3',
    mult: () => OVERDRIVE_MULT,
    left: (now) => overdriveRemaining(now),
  },
  {
    id: 'boost',
    name: 'BOOST',
    says: 'WINS + XP',
    tone: '#FFE94A',
    mult: (now) => codeBoostMult(now),
    left: (now) => boostRemaining(now),
  },
  {
    id: 'frenzy',
    name: 'FRENZY',
    says: 'FUSE ONLY',
    tone: '#FF6B3D',
    mult: () => FRENZY_MULT,
    left: (now) => frenzyRemaining(now),
  },
  {
    id: 'xp',
    name: '+25% XP',
    says: 'XP ONLY',
    tone: '#2EFFE0',
    mult: () => 1.25,
    left: (now) => (V3.stock ? V3.stock.stockFxLeft('xp', now) : 0),
  },
  {
    id: 'luck',
    name: 'LUCK',
    says: 'ROLL ODDS',
    tone: '#B04BFF',
    mult: () => 2,
    left: (now) => (V3.stock ? V3.stock.stockFxLeft('luck', now) : 0),
  },
];

/**
 * Every timer running at `now`, longest first: [{ id, name, says, tone, mult, ms }].
 * Empty when nothing is live — the dock renders nothing at rest (no idle chrome).
 */
export function liveTimers(now = Date.now()) {
  const out = [];
  for (const r of ROWS) {
    let ms = 0;
    try {
      ms = r.left(now);
    } catch {
      ms = 0;
    }
    if (!(ms > 0)) continue;
    let mult = 1;
    try {
      mult = r.mult(now);
    } catch {
      mult = 1;
    }
    if (!(mult > 1)) continue;
    out.push({ id: r.id, name: r.name, says: r.says, tone: r.tone, mult, ms });
  }
  return out.sort((a, b) => b.ms - a.ms);
}

/** ms until the LAST live timer ends (0 when none) — the one clock the dock subscribes to. */
export function anyTimerRemaining(now = Date.now()) {
  const t = liveTimers(now);
  return t.length ? t[0].ms : 0;
}
