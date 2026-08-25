// xp.js — the menu XP meta-progression MODEL. Pure and framework-free (no DOM, no React,
// no timers): the React layer owns the keydown capture, the clock, and the DOM; this file
// owns the numbers, the rate cap, and the localStorage bridge. Kept pure so the level
// curve and the anti-mash cap are unit-testable under node.
//
// Currency is XP (not letters). A menu keystroke is worth 1 XP; game modes multiply the
// per-word/letter award. `lifetimeLetters` counts RAW keystrokes (unmultiplied) and is a
// SEPARATE running total for a future profile screen — never surfaced on the menu.

// Per-MODE XP multiplier (menu is the ×1 base). The base XP per input comes from Key Power
// (10 + 2·level); this only scales it by which mode produced the input.
export const XP_MULTIPLIERS = {
  menu: 1,
  'word-bomb': 2,
  'category-blitz': 2,
  'sat-rush': 3,
  chain: 4,
  fuse: 5,
};

// Cost to advance FROM level n to n+1 — PIECEWISE (Economy v4.1, late-game runaway cap):
//   n <= 200 : gentle 1.05/level (unchanged) — need(1)=110 … need(100)=13,150, need(200)≈1.73M.
//   n  > 200 : need(200) · 1.11^(n-200) — a STEEPER top so the curve keeps pace with the
//              ×10-per-rebirth multipliers instead of one keystroke clearing many levels.
// Every value is snapped to a round multiple of 10.
//
// KNOWN LIMITATION (see the sim in the Economy v4.1 report): steepening raises cumulative XP,
// so it moves the float64 precision cliff (cumXP > MAX_SAFE_INTEGER) EARLIER, not later — the
// opposite of what a "precision above LV600" goal needs. No exponent can give both ≥200
// letters/run at R19 AND keep cumXP under MAX_SAFE through LV600; the real fix is BigInt xp.
export const CURVE_BREAK = 200; // level at which the curve steepens
export const TOP_CURVE_EXP = 1.11; // per-level growth above the break
export function need(n) {
  if (n <= CURVE_BREAK) return Math.round((100 * Math.pow(1.05, n)) / 10) * 10;
  const base = Math.round((100 * Math.pow(1.05, CURVE_BREAK)) / 10) * 10; // need(200)
  return Math.round((base * Math.pow(TOP_CURVE_EXP, n - CURVE_BREAK)) / 10) * 10;
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
// Everything EXCEPT xp survives a rebirth (wins, winsLifetime, owned, equipped, lifetimeLetters,
// taps, rounds).
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
// Perform a rebirth: zero XP (keep lifetimeLetters), bump the rebirth count. Returns the
// new count. Wins/owned/equipped/taps/rounds live under their own keys — untouched.
export function doRebirth() {
  const prog = loadProgress();
  saveProgress({ level: 1, intoLevel: 0, lifetimeLetters: prog.lifetimeLetters });
  const rc = getRebirths() + 1;
  saveRebirths(rc);
  pendingRebirth = rc;
  return rc;
}

// ---- Key Power — the repeatable base-XP upgrade ---------------------------------------
// Level stored at taw.keypower (int, default 0). The NEXT level costs 50·1.15^level wins;
// each level adds +2 to the base XP per input. SURVIVES rebirth (its own key, untouched by
// doRebirth). Cosmetics no longer affect XP at all — they're pure flair now.
export const KEYPOWER_KEY = 'taw.keypower';
export function getKeyPower() {
  try {
    const raw = localStorage.getItem(KEYPOWER_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}
export function saveKeyPower(n) {
  try {
    localStorage.setItem(KEYPOWER_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* storage blocked */
  }
}
// Cost (in wins) to buy the NEXT level, standing at `level`. Snapped to a round multiple of
// 10 (Economy v5: every displayed number ends in a zero).
export function keyPowerCost(level) {
  const lv = Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  return Math.round((50 * Math.pow(1.15, lv)) / 10) * 10;
}
// Base XP per input at a given key-power level (= purchase count). The linear +2/level
// crawl is punctuated by a MILESTONE DOUBLER: every 10th purchase permanently ×2s the base,
// and the doublers stack — base = (10 + 2·purchases) · 2^floor(purchases/10). So 9→28,
// 10→60, 20→200: the every-10th jump is what makes the curve feel exponential, not linear.
export function keyPowerBaseXp(level) {
  const lv = Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  // Snapped to a round multiple of 10 (Economy v5: every displayed XP amount ends in a zero).
  return Math.round(((10 + 2 * lv) * Math.pow(2, Math.floor(lv / 10))) / 10) * 10;
}

// The NEXT milestone doubler from a given purchase count: the next multiple of 10, and how
// many purchases remain to reach it. Drives the card's "×2 AT 10 PURCHASES (3 TO GO)" line.
export function keyPowerNextDoubler(level) {
  const lv = Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
  const at = (Math.floor(lv / 10) + 1) * 10;
  return { at, toGo: at - lv };
}

// (Level-ups no longer pay wins — wins come ONLY from finishing rounds. The old
// levelUpWins() payout was removed with Economy v3.)

// ---- The XP stack — SINGLE source of truth --------------------------------------------
// xpPerInput = keyPowerBaseXp(keyPowerLevel) · modeMult · rebirthMult · popMult · soundMult.
// The base carries the milestone doublers (see keyPowerBaseXp); the two cosmetic multipliers
// (equipped pop style + sound pack) are passed IN by the caller — xp.js stays free of the
// shop import (shop.js already imports xp.js; keeping the dependency one-way avoids a cycle).
// Factors default to the live key-power + rebirth counts (cosmetic mults default to ×1).
export function xpPerInput({ mode = 'menu', keyPowerLevel, rebirthCount, popMult = 1, soundMult = 1 } = {}) {
  const kp = Number.isFinite(keyPowerLevel) ? keyPowerLevel : getKeyPower();
  const modeMult = XP_MULTIPLIERS[mode] ?? 1;
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const pm = Number.isFinite(popMult) && popMult > 0 ? popMult : 1;
  const sm = Number.isFinite(soundMult) && soundMult > 0 ? soundMult : 1;
  // Snapped to a round multiple of 10 so every credited/displayed "+N" ends in a zero, and
  // so the accumulated xpIntoLevel stays a clean multiple of 10 (Economy v5).
  return Math.round((keyPowerBaseXp(kp) * modeMult * rebirthMult(rc) * pm * sm) / 10) * 10;
}

// Apply a credited award. Pure: takes and returns the {level, intoLevel, lifetimeLetters}
// shape (Economy v5 — level is stored EXACTLY, xpIntoLevel only ever holds progress within
// the current level so the persisted number never approaches MAX_SAFE_INTEGER). Adds the gain
// to intoLevel and carries whole levels forward via need(); reports whether a boundary was
// crossed so the caller can fire the one-shot celebration.
export function creditXp(state, xpGain, rawKeys = 1) {
  let level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  let intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  const lifetimeLetters = Number.isFinite(state && state.lifetimeLetters) ? state.lifetimeLetters : 0;
  const gain = Number.isFinite(xpGain) && xpGain > 0 ? xpGain : 0;
  const beforeLevel = level;
  intoLevel += gain;
  // Carry whole levels forward. need(level) is always > 0, so this terminates.
  while (intoLevel >= need(level)) {
    intoLevel -= need(level);
    level += 1;
  }
  const next = { level, intoLevel, lifetimeLetters: lifetimeLetters + rawKeys };
  return { state: next, leveledUp: level > beforeLevel, level };
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
// gone. loadProgress/saveProgress speak the { level, intoLevel, lifetimeLetters } model shape;
// an OLD cumulative value (a bare number written by v4 and earlier) is migrated on first read.
// Every access wrapped: a storage-blocked/absent environment reads back the fresh LV1 state
// and never throws.
export const XP_KEY = 'taw.xp';
export const LETTERS_KEY = 'taw.letters';
export const TAPS_KEY = 'taw.taps';

function readNum(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

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
    /* storage blocked */
  }
}

export function loadProgress() {
  const { level, intoLevel } = readLevelState();
  return { level, intoLevel, lifetimeLetters: readNum(LETTERS_KEY) };
}

export function saveProgress(state) {
  const level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  const intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  writeLevelState(level, intoLevel);
  try {
    localStorage.setItem(LETTERS_KEY, String(Number.isFinite(state && state.lifetimeLetters) ? state.lifetimeLetters : 0));
  } catch {
    // storage blocked — progress simply isn't persisted this session.
  }
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

// taw.taps — a SEPARATE all-time counter of credited TAPS (touch), distinct from
// lifetimeLetters (which counts only raw keystrokes). Same wrapped treatment; defaults 0.
export function getTaps() {
  try {
    const raw = localStorage.getItem(TAPS_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}
export function saveTaps(n) {
  try {
    localStorage.setItem(TAPS_KEY, String(n));
  } catch {
    // storage blocked
  }
}
