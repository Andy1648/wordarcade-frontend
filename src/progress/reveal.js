// reveal.js — FIRST-RUN PROGRESSIVE REVEAL (Andy oct22: "as we overload the user with more info — ensure things
// logically make sense from the start (like prob have things like contracts locked at first)").
//
// The season-2 menu grew a dozen systems (contracts, gears + gems, rebirth, the 2nd gear, the board, achievements,
// the update log …). A brand-new player met all of them on their first screen. This is the ONE table that says when
// each one shows, from progress signals the menu already holds — nothing new is tracked:
//
//   stage 0  (fresh)            the TITLE: wordmark, your hero, PLAY, the level bar. Nothing else.
//   core     first game OR LV3  WINS · UPGRADES · STATS · DAILY CONTRACTS · LEADERBOARD · ACHIEVEMENTS · the mode cards
//   gears    a roll affordable, a gear owned, OR LV6   GEMS · GEARS · YOUR GEAR · the update log / patch notes
//   rebirth  within REBIRTH_NEAR levels of the gate, OR any rebirth
//   gear2    the first rebirth (the R5 slot's padlock means something once you have rebirthed)
//
// A locked step is HIDDEN, except the NEXT one, which shows as a single padlocked rail tile ("LV6") — one teaser,
// never a wall of locks.
//
// NO REGRESSION FOR EXISTING PLAYERS: the first time this runs on a save that has ANY progress (a level past 1, a game,
// wins, gems, a rebirth, a gear) the save is marked ALL and sees the menu exactly as before. A live VETERAN check
// (a rebirth, ★, peak LV10+, an owned gear) opens everything too, so a cloud restore onto a fresh device catches up.
// Reveals are MONOTONIC: once a step showed it stays (a rebirth resets the level to 1 — the menu must not shrink).
//
// Season 1 (the e2e default, taw.season2.off) is never gated. PURE core (revealFor) + a small storage bridge.
import { SEASON2 } from './season.js';

export const REVEAL_KEY = 'taw.reveal';
export const CORE_LV = 3; // the core menu opens by here even if a player only types on the menu
export const GEARS_LV = 6; // the LV5 level chest pays a roll's worth of gems; LV6 is the fallback
export const REBIRTH_NEAR = 5; // the REBIRTH tile shows this many levels before its gate
export const VETERAN_PEAK = 10;

/** The ordered steps (the PR's unlock table reads this). */
export const STEPS = ['core', 'gears', 'rebirth', 'gear2'];

const n0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** A save that is clearly not a newcomer: everything shows, whatever the stored reveal says. */
export function isVeteran(s = {}) {
  return n0(s.rebirths) > 0 || n0(s.stars) > 0 || n0(s.peak) >= VETERAN_PEAK || !!s.ownsGear;
}

/** ANY progress at all — used once, on the first run of this code on a save, to grandfather existing players. */
export function hasAnyProgress(s = {}) {
  return isVeteran(s) || n0(s.level) > 1 || n0(s.peak) > 1 || !!s.playedGame || n0(s.wins) > 0 || n0(s.gems) > 0;
}

/**
 * PURE: which steps are open for signals `s` = { level, peak, rebirths, stars, playedGame, canRoll, ownsGear,
 * rebirthGate }, given the steps already revealed (`stored`: an array of step ids, or 'all').
 * Returns { all, core, gears, rebirth, gear2, title, teaser, open: [...ids] }.
 *   title  = stage 0 — the menu shows the TITLE (hero + PLAY) instead of the full menu
 *   teaser = the ONE next step shown padlocked ('gears' | 'rebirth' | null)
 */
export function revealFor(s = {}, stored = []) {
  const prev = stored === 'all' ? null : new Set(Array.isArray(stored) ? stored : []);
  const all = stored === 'all' || isVeteran(s);
  const level = Math.max(n0(s.level), n0(s.peak));
  const gate = n0(s.rebirthGate) || 15;
  const core = all || (prev && prev.has('core')) || !!s.playedGame || level >= CORE_LV;
  const gears = all || (prev && prev.has('gears')) || (core && (!!s.canRoll || !!s.ownsGear || level >= GEARS_LV));
  const rebirth = all || (prev && prev.has('rebirth')) || n0(s.rebirths) > 0 || (gears && n0(s.level) >= gate - REBIRTH_NEAR);
  const gear2 = all || (prev && prev.has('gear2')) || n0(s.rebirths) > 0;
  const flags = { core, gears, rebirth, gear2 };
  const open = STEPS.filter((id) => flags[id]);
  const teaser = !core ? null : !gears ? 'gears' : !rebirth ? 'rebirth' : null;
  return { all, ...flags, title: !core, teaser, open };
}

/** Everything open (season 1, a veteran, a blocked store). */
export const REVEAL_ALL = Object.freeze({ all: true, core: true, gears: true, rebirth: true, gear2: true, title: false, teaser: null, open: STEPS.slice() });

// ---- storage ----------------------------------------------------------------------------------------------------
/** The stored reveal: 'all', an array of step ids, or null (this code has never run on this save). */
export function readReveal(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(REVEAL_KEY);
    if (raw == null) return null;
    if (raw === 'all') return 'all';
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x) => STEPS.includes(x)) : [];
  } catch {
    return 'all'; // blocked / corrupt storage: never hide anything
  }
}
function writeReveal(v, storage) {
  try { storage.setItem(REVEAL_KEY, v === 'all' ? 'all' : JSON.stringify(v)); } catch { /* blocked: recomputed next load */ }
}

/** ?reveal=all — a dev / test switch that shows the whole menu on any save. */
function forcedAll() {
  try { return /[?&]reveal=all\b/.test(String(globalThis.location && globalThis.location.search)); } catch { return false; }
}

/**
 * The live reveal for the menu: season 1 → all. First run on a save: grandfather it (ALL) if it has any progress,
 * else start the ladder. Then the pure rule, and persist whatever newly opened (monotonic). Cheap: one small
 * storage read, a write only when a step opens.
 */
export function liveReveal(s = {}, storage = globalThis.localStorage, season2 = SEASON2) {
  if (!season2 || forcedAll()) return REVEAL_ALL;
  let stored = readReveal(storage);
  if (stored === null) {
    stored = hasAnyProgress(s) ? 'all' : [];
    writeReveal(stored, storage);
  }
  if (stored === 'all') return REVEAL_ALL;
  const r = revealFor(s, stored);
  if (r.all) { writeReveal('all', storage); return REVEAL_ALL; }
  if (r.open.some((id) => !stored.includes(id))) writeReveal(r.open, storage);
  return r;
}
