// liveBoost.js — every LIVE boost, as data, for the surfaces that show them.
//
// liveBoostRemaining: ms until the LAST live XP/WINS multiplier boost ends — the UPGRADES ×10 OVERDRIVE item (a code
// BOOST, boost.js → taw.boost) or the Rebirth Rush OVERDRIVE (overdrive.js → taw.overdrive), whichever runs longer.
// Watching only one of them was the oct8 "×10 lasts until new screen" bug (LiveStack watched overdriveRemaining alone).
//
// activeBoosts (Andy oct8: "when boosts are active they should have a timer at the bottom right … like bee swarm sim";
// "things should say — boost what?"): one row per running timer — what it is, its ×, WHAT it boosts, ms left — read
// on a 1 Hz clock only while something runs (frenzy/BoostDock.jsx). Pure reads, never writes.
import { boostRemaining } from './boost.js';
import { overdriveRemaining, OVERDRIVE_MULT } from './overdrive.js';
import { frenzyRemaining, frenzyShort, frenzyXpMult } from './frenzy.js';
import { V3 } from './season.js';

export const liveBoostRemaining = (now = Date.now()) => Math.max(boostRemaining(now), overdriveRemaining(now));

const BOOST2_KEY = 'taw.s2.boost2'; // = v3/hooks.js BOOST2_KEY (the R3 2nd code-boost slot)
function readSlot(key) {
  try {
    const o = JSON.parse(localStorage.getItem(key) || 'null');
    return o && Number(o.until) > 0 && Number(o.mult) > 1 ? { until: Number(o.until), mult: Number(o.mult) } : null;
  } catch {
    return null;
  }
}

/** [{ id, name, mult, what, ms, icon }] for every boost running at `now`, longest-lived last (stable order). */
export function activeBoosts(now = Date.now()) {
  const out = [];
  const s1 = readSlot('taw.boost');
  if (s1 && s1.until > now) {
    const od = s1.mult >= OVERDRIVE_MULT;
    out.push({ id: 'boost1', name: od ? 'OVERDRIVE' : 'BOOST', mult: `×${s1.mult}`, what: 'XP + WINS', ms: s1.until - now, icon: od ? 'overdrive' : 'boost' });
  }
  const s2 = readSlot(BOOST2_KEY);
  if (s2 && s2.until > now) out.push({ id: 'boost2', name: 'BOOST', mult: `×${s2.mult}`, what: 'XP + WINS', ms: s2.until - now, icon: 'boost' });
  const rr = overdriveRemaining(now);
  if (rr > 0) out.push({ id: 'rush', name: 'OVERDRIVE', mult: `×${OVERDRIVE_MULT}`, what: 'XP + WINS', ms: rr, icon: 'overdrive' });
  const fz = frenzyRemaining(now);
  if (fz > 0) {
    const xp = frenzyXpMult(now) > 1;
    out.push({ id: 'frenzy', name: 'FRENZY', mult: frenzyShort().split(' ')[0], what: xp ? 'XP PER KEY' : 'FUSE WINS', ms: fz, icon: 'boost' });
  }
  const st = V3 && V3.stock;
  if (st && typeof st.stockFxLeft === 'function') {
    const fx = [
      { kind: 'xp', name: 'XP BOOST', mult: '+25%', what: 'XP PER KEY', icon: 'levels' },
      { kind: 'wins', name: 'WINS BOOST', mult: '+25%', what: 'WINS PER WORD', icon: 'wins' },
      { kind: 'luck', name: 'LUCK BOOST', mult: '×2', what: 'ROLL LUCK', icon: 'luck' },
    ];
    for (const f of fx) {
      const ms = st.stockFxLeft(f.kind, now);
      if (ms > 0) out.push({ id: f.kind, name: f.name, mult: f.mult, what: f.what, ms, icon: f.icon });
    }
  }
  return out;
}

/** ms until the LAST running boost of any kind ends (0 when none) — the dock's clock. */
export const anyBoostRemaining = (now = Date.now()) => activeBoosts(now).reduce((m, b) => Math.max(m, b.ms), 0);
