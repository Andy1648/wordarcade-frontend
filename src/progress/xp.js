// xp.js — the menu XP meta-progression MODEL. Pure and framework-free (no DOM, no React,
// no timers): the React layer owns the keydown capture, the clock, and the DOM; this file
// owns the numbers, the rate cap, and the localStorage bridge. Kept pure so the level
// curve and the anti-mash cap are unit-testable under node.
//
// Currency is XP (not letters). A menu keystroke is worth 1 XP; game modes multiply the
// per-word/letter award. (Two vanity counters that fed nothing — lifetimeLetters and taps —
// were removed; the model shape is now just { level, intoLevel }.)
//
// The one dependency is the daily-streak reward multiplier (streak.js — itself dependency-free,
// so no import cycle). It only participates in xpPerInput, and only via the live default; every
// pure entry point still takes its factors as arguments, so the unit tests stay DOM-free.
import { getStreakMult } from './streak.js';
import { addMasteryWord, masteryXpMult } from './mastery.js';

// Per-MODE XP multiplier (menu is the ×1 base). The base XP per input comes from the Key Power
// TIER table (see keyTierXp); this only scales it by which mode produced the input.
export const XP_MULTIPLIERS = {
  menu: 1,
  'word-bomb': 2,
  'category-blitz': 2,
  'sat-rush': 3,
  chain: 4,
  fuse: 5,
};

// round10 — snap to the nearest multiple of 10, HALF-TO-EVEN. Half-to-even (not JS's
// default half-up Math.round) is deliberate: it is what reproduces the Economy v6 published
// level table exactly — need(1)=120 comes from round-half-even(12.5)=12, where plain
// Math.round(12.5)=13 would give 130. Used for EVERY snapped economy value (level curve, wins
// payouts, past-table Key-Power extension) so the whole system rounds one consistent way and
// every published figure lands where the spec says.
export function round10(x) {
  const q = (Number.isFinite(x) ? x : 0) / 10;
  const f = Math.floor(q);
  const r = q - f;
  let n;
  if (r < 0.5) n = f;
  else if (r > 0.5) n = f + 1;
  else n = f % 2 === 0 ? f : f + 1; // exactly .5 → round to the even neighbour
  return n * 10;
}

// Cost to advance FROM level n to n+1 — Economy v6, properly exponential where people play:
//   n <= 60 : round10(100 · 1.25^n) — the steep early climb. First levels come out
//             120 / 160 / 200 / 240 / 310 / 380 / 480 — visibly growing, not the old flat 100/110/120.
//   n  > 60 : need(60) · 1.08^(n-60), round10 — a gentler 1.08 tail so LV600 stays reachable
//             instead of the cost exploding out of range.
// Every value is snapped to a round multiple of 10 (round10, half-to-even).
export const CURVE_BREAK = 60; // level at which the curve eases from 1.25 to the 1.08 tail
export const EARLY_CURVE_EXP = 1.25; // per-level growth at/below the break
export const TOP_CURVE_EXP = 1.08; // per-level growth above the break
export function need(n) {
  if (n <= CURVE_BREAK) return round10(100 * Math.pow(EARLY_CURVE_EXP, n));
  const base = round10(100 * Math.pow(EARLY_CURVE_EXP, CURVE_BREAK)); // need(60)
  return round10(base * Math.pow(TOP_CURVE_EXP, n - CURVE_BREAK));
}

// Level (and progress within it) derived from a cumulative XP total. Level 1 starts at
// 0 XP. Returns the level, XP into the current level, that level's cost, the remainder to
// the next level, and the 0..1 fill fraction for the bar.
export function levelFromXp(xp) {
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  let spent = 0; // cumulative cost consumed to REACH `level`
  while (total - spent >= need(level)) {
    spent += need(level);
    level += 1;
  }
  const cost = need(level);
  const intoLevel = total - spent;
  return {
    level,
    intoLevel,
    cost,
    toNext: cost - intoLevel,
    frac: cost > 0 ? intoLevel / cost : 0,
  };
}

// ---- Rebirth --------------------------------------------------------------------------
// Rebirth zeroes XP/level for a permanent multiplier. The ladder is the REAL Keyboard Escape
// curve, HARDCODED as a table (index 0 = R1): each entry is the LEVEL required to perform that
// rebirth and the permanent XP MULTIPLIER it grants. Multipliers ramp gently through R10 (×10)
// then explode (R11 ×100 … R20 ×1e11). Past R20 the pattern continues: +50 levels and ×10 per
// rebirth. Stored as DATA, not a formula, so the published curve is the source of truth.
// Everything EXCEPT xp survives a rebirth (wins, winsLifetime, owned, equipped, rounds).
export const REBIRTH_KEY = 'taw.rebirths';
export const REBIRTH_TABLE = [
  { level: 15, mult: 1.5 }, //   R1
  { level: 25, mult: 2 }, //     R2
  { level: 40, mult: 2.5 }, //   R3
  { level: 60, mult: 3 }, //     R4
  { level: 75, mult: 3.5 }, //   R5
  { level: 100, mult: 4 }, //    R6
  { level: 125, mult: 5 }, //    R7
  { level: 150, mult: 6 }, //    R8
  { level: 175, mult: 8 }, //    R9
  { level: 200, mult: 10 }, //   R10
  { level: 225, mult: 100 }, //  R11
  { level: 260, mult: 1000 }, // R12
  { level: 300, mult: 10000 }, //R13
  { level: 340, mult: 100000 }, // R14
  { level: 380, mult: 1e6 }, //  R15
  { level: 420, mult: 1e7 }, //  R16
  { level: 465, mult: 1e8 }, //  R17
  { level: 510, mult: 1e9 }, //  R18
  { level: 560, mult: 1e10 }, // R19
  { level: 600, mult: 1e11 }, // R20
];
const REBIRTH_PAST_LEVEL_STEP = 50; // +50 levels per rebirth past R20 (R21→650, R22→700 …)
const REBIRTH_PAST_MULT_STEP = 10; // ×10 multiplier per rebirth past R20 (R21→1e12 …)

export function getRebirths() {
  try {
    const raw = localStorage.getItem(REBIRTH_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
export function saveRebirths(n) {
  try {
    localStorage.setItem(REBIRTH_KEY, String(n));
  } catch {
    /* storage blocked */
  }
}
// The LEVEL required to perform the NEXT rebirth, given how many are already done. rc=0 gates
// R1 at LV15; rc=19 gates R20 at LV600; past that, +50 levels each (R21→650, R22→700 …).
export function rebirthThreshold(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) && rebirthCount > 0 ? Math.floor(rebirthCount) : 0;
  if (rc < REBIRTH_TABLE.length) return REBIRTH_TABLE[rc].level;
  const last = REBIRTH_TABLE.length - 1; // R20
  return REBIRTH_TABLE[last].level + REBIRTH_PAST_LEVEL_STEP * (rc - last);
}
// The permanent XP multiplier AFTER `rebirthCount` rebirths. rc=0 → ×1 (none done); rc=n≤20 →
// Rn's tabled multiplier; past R20 → ×10 per rebirth from R20's ×1e11 (R21→1e12 …).
export function rebirthMult(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) && rebirthCount > 0 ? Math.floor(rebirthCount) : 0;
  if (rc === 0) return 1;
  if (rc <= REBIRTH_TABLE.length) return REBIRTH_TABLE[rc - 1].mult;
  const last = REBIRTH_TABLE.length - 1; // R20
  return REBIRTH_TABLE[last].mult * Math.pow(REBIRTH_PAST_MULT_STEP, rc - REBIRTH_TABLE.length);
}
export function canRebirth(xp, rebirthCount = getRebirths()) {
  return levelFromXp(xp).level >= rebirthThreshold(rebirthCount);
}
// A one-shot "REBIRTH N" celebration queued on confirm, consumed by the homepage on the
// next menu visit (same pattern as the wins stamp).
let pendingRebirth = 0;
export function consumePendingRebirth() {
  const n = pendingRebirth;
  pendingRebirth = 0;
  return n;
}
// Perform a rebirth: zero XP, bump the rebirth count. Returns the new count.
// Wins/owned/equipped/rounds live under their own keys — untouched.
export function doRebirth() {
  saveProgress({ level: 1, intoLevel: 0 });
  const rc = getRebirths() + 1;
  saveRebirths(rc);
  pendingRebirth = rc;
  return rc;
}

// ---- Key Power — DISCRETE TIERS (Economy v6) ------------------------------------------
// Tier stored at taw.keytier (int, default 0). Key Power is no longer a per-level crawl with
// a doubler — it is a hardcoded TABLE of tiers, each a real one-at-a-time decision. `xp` is the
// XP PER LETTER granted at that tier; `cost` is the wins price to REACH that tier (T0 is the
// free start, so its cost is 0). Every cost is a round multiple of 10; effect values are the
// published figures and need NOT end in a zero (375, 5875, 14690). SURVIVES rebirth (its own
// key, untouched by doRebirth).
//   T0   10 XP/letter    free (start)
//   T1   25              500 wins
//   T2   60              3,000
//   T3   150             18,000
//   T4   375             108,000
//   T5   940             648,000
//   T6   2,350           3,888,000
//   T7   5,875           23,328,000
//   T8   14,690          139,968,000
// Past T8 the pattern continues: effect ×2.5, cost ×6, each round10 (half-to-even).
export const KEYTIER_KEY = 'taw.keytier';
export const KEY_TIERS = [
  { xp: 10, cost: 0 }, //          T0
  { xp: 25, cost: 500 }, //        T1
  { xp: 60, cost: 3000 }, //       T2
  { xp: 150, cost: 18000 }, //     T3
  { xp: 375, cost: 108000 }, //    T4
  { xp: 940, cost: 648000 }, //    T5
  { xp: 2350, cost: 3888000 }, //  T6
  { xp: 5875, cost: 23328000 }, // T7
  { xp: 14690, cost: 139968000 }, //T8
];
const TIER_XP_STEP = 2.5; // effect multiplier per tier past T8
const TIER_COST_STEP = 6; // cost multiplier per tier past T8

export function getKeyTier() {
  try {
    const raw = localStorage.getItem(KEYTIER_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
export function saveKeyTier(n) {
  try {
    localStorage.setItem(KEYTIER_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* storage blocked */
  }
}

// XP PER LETTER at a given tier. Within the table it's the published value; past T8 it extends
// ×2.5 per tier from T8's 14,690, each step round10 (half-to-even).
export function keyTierXp(tier) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 0;
  if (t < KEY_TIERS.length) return KEY_TIERS[t].xp;
  let xp = KEY_TIERS[KEY_TIERS.length - 1].xp;
  for (let i = KEY_TIERS.length; i <= t; i++) xp = round10(xp * TIER_XP_STEP);
  return xp;
}
// The wins cost to REACH a given tier (T0 = 0). Within the table it's the published price; past
// T8 it extends ×6 per tier from T8's 139,968,000, each step round10.
export function keyTierCostAt(tier) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 0;
  if (t < KEY_TIERS.length) return KEY_TIERS[t].cost;
  let cost = KEY_TIERS[KEY_TIERS.length - 1].cost;
  for (let i = KEY_TIERS.length; i <= t; i++) cost = round10(cost * TIER_COST_STEP);
  return cost;
}
// The wins cost to BUY the NEXT tier, standing at `tier` — i.e. the cost to REACH tier+1.
export function keyTierCost(tier) {
  const t = Number.isFinite(tier) && tier >= 0 ? Math.floor(tier) : 0;
  return keyTierCostAt(t + 1);
}

// (Level-ups no longer pay wins — wins come ONLY from finishing rounds. The old
// levelUpWins() payout was removed with Economy v3.)

// ---- The XP stack — SINGLE source of truth --------------------------------------------
// xpPerInput = keyTierXp(keyTier) · modeMult · rebirthMult · popMult · soundMult. The base is
// the Key Power TIER's XP-per-letter (Economy v6); the two cosmetic multipliers (equipped pop
// style + sound pack) are passed IN by the caller — xp.js stays free of the shop import (shop.js
// already imports xp.js; keeping the dependency one-way avoids a cycle). Factors default to the
// live key-tier + rebirth counts (cosmetic mults default to ×1).
export function xpPerInput({ mode = 'menu', keyTier, rebirthCount, popMult = 1, soundMult = 1, streakMult } = {}) {
  const kt = Number.isFinite(keyTier) ? keyTier : getKeyTier();
  const modeMult = XP_MULTIPLIERS[mode] ?? 1;
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const pm = Number.isFinite(popMult) && popMult > 0 ? popMult : 1;
  const sm = Number.isFinite(soundMult) && soundMult > 0 ? soundMult : 1;
  // Daily-streak reward multiplier folds into the SAME stack (defaults to the live streak, 1 at
  // <3 days). Passed explicitly by tests; live-read otherwise, exactly like keyTier/rebirth.
  const stm = Number.isFinite(streakMult) && streakMult > 0 ? streakMult : getStreakMult();
  // Snapped to a round multiple of 10 so every credited/displayed "+N" ends in a zero, and
  // so the accumulated xpIntoLevel stays a clean multiple of 10.
  return round10(keyTierXp(kt) * modeMult * rebirthMult(rc) * pm * sm * stm);
}

// Apply a credited award. Pure: takes and returns the {level, intoLevel} shape (Economy v5 — level
// is stored EXACTLY, xpIntoLevel only ever holds progress within the current level so the persisted
// number never approaches MAX_SAFE_INTEGER). Adds the gain to intoLevel and carries whole levels
// forward via need(); reports whether a boundary was crossed so the caller can fire the one-shot
// celebration. (The old rawKeys arg only fed the removed lifetimeLetters counter — it is gone.)
export function creditXp(state, xpGain) {
  let level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  let intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  const gain = Number.isFinite(xpGain) && xpGain > 0 ? xpGain : 0;
  const beforeLevel = level;
  intoLevel += gain;
  // Carry whole levels forward. need(level) is always > 0, so this terminates.
  while (intoLevel >= need(level)) {
    intoLevel -= need(level);
    level += 1;
  }
  const next = { level, intoLevel };
  return { state: next, leveledUp: level > beforeLevel, level };
}

// ---- Per-word XP for IN-GAME play (unified economy, Job 1) -----------------------------
// The two loops used to be disjoint: XP came ONLY from menu keystrokes, wins ONLY from games —
// so playing never levelled you and menu typing never bought anything. Now every accepted word in
// EVERY mode grants XP too, so the loops compound. The grant reuses the SAME per-word reward weight
// the wins payout already computes (rarity × combo × lucky, capped — cappedWordMult), so a
// rarer/hotter/luckier word is worth proportionally more XP exactly as it is worth more wins. The
// amount is the menu-typing value of the word's letters (keyTierXp × length) × the mode's XP
// multiplier × that weight (× rebirth × streak) — every mode's XP mult is ≥2, so playing is always
// clearly faster than the menu, which stays the deliberate slow lane.
export const PER_WORD_MULT_CAP = 40; // clip the combined rarity×combo×lucky product (clips the p99.9
// tail — an OBSCURE word typed on a full ×3 combo that also hits the 1/40 lucky roll: 4.5×3×5≈67).
export function cappedWordMult(rarityMult = 1, comboMult = 1, luckyMult = 1) {
  const r = Number.isFinite(rarityMult) && rarityMult > 0 ? rarityMult : 1;
  const c = Number.isFinite(comboMult) && comboMult > 0 ? comboMult : 1;
  const l = Number.isFinite(luckyMult) && luckyMult > 0 ? luckyMult : 1;
  return Math.min(PER_WORD_MULT_CAP, r * c * l);
}

// XP granted for one accepted word. Pure given its factors (mode/keyTier/rebirth/streak default to
// live). `wordLength` is the menu-equivalent letter count; `weight` is the capped per-word reward
// mult. Snapped to a round 10 like every other XP grant so the accumulated xpIntoLevel stays clean.
export function xpPerWord({ mode = 'menu', keyTier, rebirthCount, wordLength = 1, weight = 1, streakMult } = {}) {
  const kt = Number.isFinite(keyTier) ? keyTier : getKeyTier();
  const modeMult = XP_MULTIPLIERS[mode] ?? 1;
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const len = Number.isFinite(wordLength) && wordLength > 0 ? Math.floor(wordLength) : 1;
  const wt = Number.isFinite(weight) && weight > 0 ? weight : 1;
  const stm = Number.isFinite(streakMult) && streakMult > 0 ? streakMult : getStreakMult();
  return round10(keyTierXp(kt) * len * modeMult * rebirthMult(rc) * wt * stm);
}

// Credit one accepted word's XP to the persisted level state; returns creditXp's result plus the
// gain ({ state, leveledUp, level, gain }). Persistence happens here so returning to the menu
// reflects the levels earned in play; the caller may use `leveledUp` to fire a celebration.
export function awardWordXp(opts = {}) {
  const mode = opts.mode || 'menu';
  // MASTERY (Job 2): this mode's mastery level multiplies the word's XP (+3%/level above M1). The
  // multiplier is read BEFORE crediting the word to mastery, so a word never retroactively boosts
  // itself. round10 keeps the "+N ends in a zero" invariant after the mastery scale.
  const gain = round10(xpPerWord(opts) * masteryXpMult(mode));
  const res = creditXp(loadProgress(), gain);
  saveProgress(res.state);
  const mastery = addMasteryWord(mode); // credit this accepted word to the mode's mastery track
  return { ...res, gain, mastery };
}

// Anti-mash rate cap: at most `capacity` credited keystrokes per rolling `windowMs`. Pure
// given an injected `now` (ms). Over-cap calls return false so the caller drops them
// silently (no XP, no popup, no sound). Held keys / modifier chords are filtered upstream
// by isCreditableKey, not here.
export function createRateLimiter({ capacity = 30, windowMs = 1000 } = {}) {
  let stamps = [];
  return {
    tryConsume(now) {
      stamps = stamps.filter((t) => now - t < windowMs);
      if (stamps.length >= capacity) return false;
      stamps.push(now);
      return true;
    },
  };
}

// Is this keydown a creditable menu keystroke? Single a-z/0-9 character, not an
// auto-repeat, no ctrl/meta/alt, and NOT typed into a real field (input/textarea/
// contenteditable). The dialog/modal-open guard is DOM/app state and lives in the caller.
export function isCreditableKey(e) {
  if (!e) return false;
  if (e.repeat) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key;
  if (typeof k !== 'string' || k.length !== 1 || !/[a-z0-9]/i.test(k)) return false;
  const t = e.target;
  if (t) {
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
    if (t.isContentEditable) return false;
  }
  return true;
}

// ---- Persistence ---------------------------------------------------------------------
// Economy v5 storage shape: taw.xp holds { lv, into } — the level (an exact integer) and the
// XP INTO that level (always < need(lv)). The stored number therefore never exceeds one
// level's cost, so the float64 MAX_SAFE_INTEGER cliff that cumulative XP hit above ~LV600 is
// gone. loadProgress/saveProgress speak the { level, intoLevel } model shape;
// an OLD cumulative value (a bare number written by v4 and earlier) is migrated on first read.
// Every access wrapped: a storage-blocked/absent environment reads back the fresh LV1 state
// and never throws.
export const XP_KEY = 'taw.xp';

// A fresh, valid { level, intoLevel } for any state we can't trust.
const FRESH = { level: 1, intoLevel: 0 };

// Read + normalise { level, intoLevel } from taw.xp, migrating the legacy cumulative-number
// shape exactly once. New shape: '{"lv":n,"into":m}'. Legacy shape: a bare number string.
function readLevelState() {
  let raw;
  try {
    raw = localStorage.getItem(XP_KEY);
  } catch {
    return { ...FRESH };
  }
  if (raw == null) return { ...FRESH };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...FRESH };
  }
  // New shape.
  if (parsed && typeof parsed === 'object' && Number.isFinite(parsed.lv)) {
    let level = Math.max(1, Math.floor(parsed.lv));
    let into = Number.isFinite(parsed.into) && parsed.into > 0 ? parsed.into : 0;
    const cost = need(level);
    if (into >= cost) into = 0; // corrupt/overflowed → clamp into the level
    return { level, intoLevel: into };
  }
  // Legacy cumulative number → derive {level, into} once and rewrite in the new shape. Floor
  // the carried progress to a round 10 so the very first post-migration readout still ends in 0.
  if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
    const d = levelFromXp(parsed);
    const migrated = { level: d.level, intoLevel: Math.floor(d.intoLevel / 10) * 10 };
    writeLevelState(migrated.level, migrated.intoLevel);
    return migrated;
  }
  return { ...FRESH };
}

function writeLevelState(level, intoLevel) {
  try {
    localStorage.setItem(XP_KEY, JSON.stringify({ lv: Math.max(1, Math.floor(level)), into: Math.max(0, intoLevel) }));
  } catch {
    // storage blocked / quota. NOTE (JOB 19): a QuotaExceededError here means progress can no
    // longer be saved — worth reporting — but this module is deliberately pure/framework-free
    // (unit-tested under node, no Sentry import), so it can't call reportError directly. A
    // non-pure `safeStorage` wrapper is the right home for that capture (see claude/error-reporting.md).
  }
}

export function loadProgress() {
  const { level, intoLevel } = readLevelState();
  return { level, intoLevel };
}

export function saveProgress(state) {
  const level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  const intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  writeLevelState(level, intoLevel);
}

// The display-progress object for a { level, intoLevel } state: the level, XP into it, that
// level's cost, the remainder, and the 0..1 fill fraction for the bar. The direct-from-shape
// analogue of levelFromXp (which still derives the same fields from a cumulative total).
export function progressOf(state) {
  const level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  const intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  const cost = need(level);
  return { level, intoLevel, cost, toNext: cost - intoLevel, frac: cost > 0 ? intoLevel / cost : 0 };
}

