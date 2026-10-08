// liveTimers.js — EVERY running boost, as one list, for the corner BOOST DOCK and the STATS BOOSTS panel.
//
// ANDY (R5 oct8): "when boosts are active they should have a timer at the bottom right of the screen instead of
// dead center … things like this should say — boost WHAT?" So each row carries not just a clock but the NAME of
// what it multiplies — the dock is the one place a player can read every live effect at once.
//
// PURE + guarded: every source already guards its own storage, and the v3 STOCK effects are read through the V3
// holder (season.js) so this module never pulls the v3 chunk into the eager bundle (payload ratchet).
// The `says` wording matches each item's WHAT line in the shop (v3/stock.js), so the card you bought and the
// row counting it down say the same thing.
import { boostRemaining, codeBoostMult } from './boost.js';
import { overdriveRemaining, OVERDRIVE_MULT } from './overdrive.js';
import { frenzyRemaining, frenzyMult, frenzyXpMult } from './frenzy.js';
import { V3 } from './season.js';

// tone = the house colour the row wears; `says` answers "boost WHAT?" in one phrase.
const ROWS = [
  {
    id: 'overdrive',
    name: 'OVERDRIVE',
    says: 'XP + WINS',
    tone: '#FF4FA3',
    mult: () => OVERDRIVE_MULT,
    left: (now) => overdriveRemaining(now),
  },
  {
    id: 'boost',
    name: 'BOOST',
    says: 'XP + WINS',
    tone: '#FFE94A',
    mult: (now) => codeBoostMult(now),
    left: (now) => boostRemaining(now),
  },
  {
    // FRENZY is two different things by season: season 2 pays ×25 on XP PER KEY everywhere (frenzyXpMult),
    // season 1 pays ×5 on FUSE WINS (frenzyMult). Read whichever is live so the row never quotes a
    // multiplier the game will not pay.
    id: 'frenzy',
    name: 'FRENZY',
    says: (now) => (frenzyXpMult(now) > 1 ? 'XP PER KEY' : 'FUSE WINS'),
    tone: '#FF6B3D',
    mult: (now) => Math.max(frenzyXpMult(now), frenzyMult('fuse', now)),
    left: (now) => frenzyRemaining(now),
  },
  {
    id: 'xp',
    name: 'XP BOOST',
    says: 'XP PER KEY',
    tone: '#2EFFE0',
    mult: () => 1.25,
    left: (now) => (V3.stock ? V3.stock.stockFxLeft('xp', now) : 0),
  },
  {
    id: 'wins',
    name: 'WINS BOOST',
    says: 'WINS PER WORD',
    tone: '#FFC23D',
    mult: () => 1.25,
    left: (now) => (V3.stock ? V3.stock.stockFxLeft('wins', now) : 0),
  },
  {
    id: 'luck',
    name: 'LUCK BOOST',
    says: 'ROLL LUCK',
    tone: '#B04BFF',
    mult: () => 2,
    left: (now) => (V3.stock ? V3.stock.stockFxLeft('luck', now) : 0),
  },
];

/**
 * Every timer running at `now`, longest first: [{ id, name, says, tone, mult, ms }].
 * Empty when nothing is live — the dock renders nothing at rest (no idle chrome).
 * "Is anything running at all?" is anyTimer.js: that question is asked eagerly, this table is not.
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
    let says = '';
    try {
      says = typeof r.says === 'function' ? r.says(now) : r.says;
    } catch {
      says = '';
    }
    out.push({ id: r.id, name: r.name, says, tone: r.tone, mult, ms });
  }
  return out.sort((a, b) => b.ms - a.ms);
}
