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
// so no import cycle). It only participates in xpPerInput/xpPerWord, and only via the live default;
// every pure entry point still takes its factors as arguments, so the unit tests stay DOM-free.
import { getStreakMult } from './streak.js';
import { noteLevelReached } from './gems.js'; // GEMS: LEVEL_UP (a leaf module — no cycle)

// Per-MODE XP multiplier (menu is the ×1 base). The base XP per input comes from the Key Tier
// TIER table (see keyTierXp); this only scales it by which mode produced the input.
// MODE POWER (Andy oct2: "mode power must show in payouts"). Read against Word Bomb (×2 = POWER ×1):
//   SAT RUSH ×10 = POWER ×5 — its card power is real money per word, not a label
//   CHAIN    ×4  = POWER ×2 — higher wins per word
//   FUSE     ×2  = POWER ×1 — the SAME per word as Word Bomb; its higher bar is FRENZY (frenzy.js,
//                             ×5 wins for 5 real minutes after a full a–z strip)
export const XP_MULTIPLIERS = {
  menu: 1,
  'word-bomb': 2,
  'category-blitz': 2,
  'sat-rush': 10,
  chain: 4,
  fuse: 2,
  // WORD RACE: a 12-word fragment sprint vs people — no lives, no per-word clock, so it pays
  // a little above the turn-based rooms (×2).
  'word-race': 3,
};
// The POWER a card shows: the mode's multiplier relative to Word Bomb (WB = ×1).
export const POWER_BASE_MODE = 'word-bomb';
export function modePower(mode) {
  const m = XP_MULTIPLIERS[mode];
  return Number.isFinite(m) ? m / XP_MULTIPLIERS[POWER_BASE_MODE] : 1;
}

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

// Cost to advance FROM level n to n+1 — Economy v8.
//
// WHAT WAS WRONG WITH v7, and it was the BASE, not the shape. v7 opened at 2,000 XP for level 1
// and grew 1.085 per level. A fresh profile earns 150 XP for a five-letter Word Bomb word on
// CRAZY, so LEVEL 1 TOOK FOURTEEN WORDS and level 10 took two hundred and forty — with a bar
// that barely moved per word, because 150 against 2,000 is a seven-percent sliver. The first
// twenty minutes of the game are where a progression system has to prove it exists, and v7 spent
// them showing the player a bar that looked stuck.
//
// v8 IS THE SAME TWO-SEGMENT SHAPE WITH THE NUMBERS PULLED IN HARD:
//   n <= 30 : round10(600 · 1.16^(n-1))          — need(1) = 600, i.e. FOUR words
//   n  > 30 : need(30) · 1.22^(n-30)             — STEEPER, never shallower
// Base 600 down from 2,000 (a level is now four words, not fourteen) and the exponents up from
// 1.085/1.135 to 1.16/1.22 — a lower floor buys the room for a much faster climb, so the early
// levels arrive in words rather than minutes and the curve still reaches a real wall. The break
// moves 100 -> 30 because with a 1.16 early slope the first thirty levels ARE the early game;
// waiting until 100 to harden would have left seventy levels of the same easy step.
//
// THE EXPONENT IS OFF n-1, NOT n. need(1) is the base itself. v7 indexed off n, so its own
// "base" was never a cost anyone paid — need(1) was already base × the exponent. Naming a
// constant after a value the game never uses is how a curve gets retuned by feel instead of by
// arithmetic.
//
// (v8 history: TOP_CURVE_EXP > EARLY_CURVE_EXP guarded a flattening tail. v9 guards "never cheaper per level" instead.)
// defect was a tail that went the other way, getting CHEAPER per level while income compounded.
// Every value is snapped to a round multiple of 10 (round10, half-to-even).
export const CURVE_BASE = 600; // need(1) EXACTLY — the whole curve scales from here
export const CURVE_BREAK = 30; // level at which the curve HARDENS (levels 1..30 are the early game)
export const EARLY_CURVE_EXP = 1.16; // per-level growth at/below the break
export const TOP_CURVE_EXP = 1.22; // v8 growth above the break — kept for the before/after record only
// ECONOMY v9 (STEP 19 / Andy A6): above the break the curve is POLYNOMIAL, not geometric. A geometric
// tail (×1.22 a level) outran every income source after ~L175 and produced the multi-hour walls and
// 19-digit level costs in claude/progression/before-report.md; a power of the level grows the time
// per level gently instead.
export const CURVE_POW = 4;
// Past CURVE_TAIL the curve turns geometric again (×CURVE_TAIL_EXP a level): the polynomial alone let
// the very long tail (KEY tiers → levels → rebirths → income) run away to L3,000 in the 200 h sim.
export const CURVE_TAIL = 300;
export const CURVE_TAIL_EXP = 1.03;
// ECONOMY v9 CURVE, FROZEN (PROGRESSION v10, must-fix 1). This is EXACTLY the need() every save before
// v10 was written against. It is used for ONE thing: converting a legacy {lv, into} (or a bare
// cumulative number, via levelFromXp) into the FRACTION of the level it represents. Never retune it —
// a legacy `into` only means something against the curve that produced it.
export function needV9(n) {
  if (n <= CURVE_BREAK) return round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, n - 1));
  const base = round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, CURVE_BREAK - 1)); // need(30)
  const poly = (L) => base * Math.pow(L / CURVE_BREAK, CURVE_POW);
  if (n <= CURVE_TAIL) return round10(poly(n));
  return round10(poly(CURVE_TAIL) * Math.pow(CURVE_TAIL_EXP, n - CURVE_TAIL));
}

// ---- PROGRESSION v11 (amended oct3 18:15) — ONE FIXED CURVE FOR EVERYONE (claude/econ-oct2/v11-spec.md) ----
// ANDY: "THE XP NEEDED PER LEVEL NEVER SCALES WITH THE PLAYER" and "smoother and QUICKER than the live v10,
// each level only a BIT harder than the last — in between v9 (L^4, too soft) and v10 (too steep)".
//   need(n) = round10(100 + 15 · n² · 1.004^(n−1))
// A quadratic with a gentle exponential lean: LV1 120, LV10 1,650, LV50 ~45.7k, LV100 ~223k, LV200 ~1.33M,
// LV400 ~11.8M. The step to the next level is +21% at LV10, +4% at LV50, +2.4% at LV100, +1.4% at LV200 —
// always harder, never a wall. The same numbers for a fresh profile and an R20 T30 save.
// Always finite and > 0: capped at Number.MAX_VALUE (far past any reachable level), never Infinity/NaN/0.
// PROGRESSION FINAL — "REBIRTH RUSH" v2 (Andy oct3 20:08, claude/econ-oct2/PROGRESSION-FINAL.md; FROZEN structure,
// later only constants ±20% after a CI sim):   need(n) = round10(100 · 1.15^(n−1)), the same for everyone.
// Every level 15% more than the last. A run hits a WALL; REBIRTH (×5 XP & wins, forever) blows past it.
export const CURVE_BASE_XP = 100; // need(1)
export const CURVE_GROWTH = 1.15; // +15% a level, every level
// (kept for the record: the 19:54 KE curve 100·1.13^n and the v11 quadratic. Nothing reads them.)
export const CURVE_KE_BASE = 100;
export const CURVE_KE_GROWTH = 1.13;
export const CURVE_V11_BASE = 100;
export const CURVE_V11_A = 15;
export const CURVE_V11_POW = 2;
export const CURVE_V11_LEAN = 1.004;

/** need(n) — PURE, the ONE curve. Any extra argument (v10's power) is ignored. Finite, ≥ 100. */
export function needAt(n) {
  let lv;
  if (Number.isFinite(n)) lv = Math.max(1, Math.floor(n));
  else if (n === Infinity) return Number.MAX_VALUE;
  else lv = 1; // NaN / -Infinity / garbage → LV1
  const raw = CURVE_BASE_XP * Math.pow(CURVE_GROWTH, lv - 1);
  if (!(raw < Number.MAX_VALUE)) return Number.MAX_VALUE; // Infinity / NaN → the cap, never 0
  const r = round10(raw);
  if (!(r > 0)) return 10;
  return Math.min(r, Number.MAX_VALUE);
}

// Cost to advance FROM level n to n+1. The same for every save (no KEY tier, no rebirth, no storage read).
export function need(n) {
  return needAt(n);
}

// ---- PROGRESSION v11 — THE BAR FILLS FROM LETTERS --------------------------------------------------
// ANDY: "GAME WORDS GIVE WINS ONLY." / "THE BAR fills from typing LETTERS (menu + in-game) × KEY tier
// XP/letter × rebirth/mark XP boosts. That's the loop: play → wins → buy KEY → more XP per letter → level
// faster." So:
//   XP per letter = BASE 10 × KEY(T) × REBIRTH(R) × MARK
//     KEY(T)     = 1.2^T   — every KEY tier: +20% XP / LETTER, compounding (T5 ×2.49, T10 ×6.19)
//     REBIRTH(R) = 1 + R   — every rebirth: +100% (the SAME ×(1+R) wins get)
//     MARK       = the worn MAIN mark: COMMON +10%, RARE +20%, EPIC +30%, LEGENDARY / PERMANENT +50%
//                  (resolved by letterXp.js — marks.js sits above this module in the import graph)
// WINS keep their big exponential stack (xpPerWord ÷ 10, KEY ×2.5 a tier) — untouched; they never move the bar.
export const LEVEL_XP_PER_LETTER = 10; // "BASE 10 XP / LETTER"
export const KEY_XP_STEP = 1.2; // ×1.2 a KEY tier — "+20% XP / LETTER"
export const REBIRTH_XP_STEP = 1; // +100% a rebirth
const KEY_XP_CAP = 1e300; // finite at absurd tiers (1.2^3800 would overflow)

// KEY (Rebirth Rush, Keyboard Escape style): ×1, ×2, ×5, ×10, ×25, ×50, ×100, ×250, ×500, ×1000 (T0–T9),
// then ×2.15 a tier forever. RESETS on rebirth (doRebirth); wins are KEPT, so a new run opens with a
// rebuy spree.
export const KEY_LADDER = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000];
export const KEY_PAST_LADDER_STEP = 2.15;
/** KEY tier → XP-per-letter multiplier (the ladder above). Finite at any tier. */
export function keyXpMult(tier) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 0;
  if (t < KEY_LADDER.length) return KEY_LADDER[t];
  const v = KEY_LADDER[KEY_LADDER.length - 1] * Math.pow(KEY_PAST_LADDER_STEP, t - (KEY_LADDER.length - 1));
  return Number.isFinite(v) ? Math.min(v, KEY_XP_CAP) : KEY_XP_CAP;
}
// REBIRTH (Rebirth Rush): ×5 XP AND wins per rebirth, forever — 5^R (R1 ×5, R2 ×25, R10 ×9.77M). The SAME
// number on the bar and on wins (rebirthMult below). Finite at any count (capped far past a double's reach).
export const REBIRTH_POWER = 5;
const REBIRTH_CAP = 1e300;
export function rebirthPow(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) && rebirthCount > 0 ? Math.floor(rebirthCount) : 0;
  const v = Math.pow(REBIRTH_POWER, rc);
  return Number.isFinite(v) ? Math.min(v, REBIRTH_CAP) : REBIRTH_CAP;
}
/** Rebirth count → XP-per-letter multiplier: 5^R. */
export function rebirthXpMult(rebirthCount) {
  return rebirthPow(rebirthCount);
}
// MARKS v2: a worn +N BASE XP/LETTER mark adds to BASE 10 before every multiplier. Injected (letterXp.js installs
// markRollsCore.markBaseXp) — that module sits above this one. Default +0, so pure callers are unchanged.
let letterBaseAdd = () => 0;
export function setLetterBaseAdd(fn) {
  if (typeof fn === 'function') letterBaseAdd = fn;
}
function liveLetterBaseAdd() {
  try {
    const v = letterBaseAdd();
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}
/**
 * XP per LETTER typed (menu or in-game): (BASE 10 + the worn mark's BASE XP/LETTER) × KEY × REBIRTH × the worn-mark
 * XP boost. `baseAdd` omitted → the worn mark's (+0 with nothing worn). PURE given its arguments.
 */
export function levelXpPerLetter(keyTier, rebirthCount, markMult = 1, baseAdd) {
  const kt = Number.isFinite(keyTier) ? keyTier : getKeyTier();
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const mm = Number.isFinite(markMult) && markMult > 0 ? markMult : 1;
  const add = baseAdd === undefined ? liveLetterBaseAdd() : Number.isFinite(baseAdd) && baseAdd > 0 ? baseAdd : 0;
  // KEY and REBIRTH are each capped at 1e300, but their PRODUCT is not: past ~R430 it overflowed to Infinity,
  // and creditXp drops a non-finite gain to 0 — the bar would silently stop filling. Clamp the product.
  return finiteCap((LEVEL_XP_PER_LETTER + add) * keyXpMult(kt) * rebirthXpMult(rc) * mm);
}
// A product of capped factors can still overflow: clamp it to 1e300 (Infinity → the cap, NaN → 0).
const PRODUCT_CAP = 1e300;
export function finiteCap(v) {
  if (Number.isNaN(v)) return 0;
  return Math.min(v, PRODUCT_CAP);
}

// Level (and progress within it) derived from a cumulative XP total. Level 1 starts at
// 0 XP. Returns the level, XP into the current level, that level's cost, the remainder to
// the next level, and the 0..1 fill fraction for the bar.
//
// MIGRATION-ONLY (Economy v6 stores {lv, into}, never a cumulative — see creditXp). This is the
// one place that walks a cumulative sum, and a cumulative sum of need() is exactly what overflows
// 2^53 at absurd levels. A real legacy value never gets near that, but guard it anyway: cap the
// walk at LEVEL_CAP so a corrupt/huge legacy number can't spin the loop or accumulate a
// meaningless float — the LIVE path (creditXp) is unaffected and stays exact to level 600+.
const LEVEL_CAP = 10000;
export function levelFromXp(xp) {
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  let spent = 0; // cumulative cost consumed to REACH `level`
  // v10: a cumulative total is a LEGACY value, so it is walked against the frozen v9 curve.
  while (level < LEVEL_CAP && total - spent >= needV9(level)) {
    spent += needV9(level);
    level += 1;
  }
  const cost = needV9(level);
  // At the LEVEL_CAP the remainder can exceed one level's cost (only a hand-made legacy total gets
  // here): clamp so the bar reads full rather than reporting frac > 1 / a negative toNext.
  const intoLevel = Math.min(total - spent, cost);
  return {
    level,
    intoLevel,
    cost,
    toNext: cost - intoLevel,
    frac: cost > 0 ? intoLevel / cost : 0,
  };
}

// ---- Rebirth --------------------------------------------------------------------------
// Rebirth zeroes XP/level for a permanent multiplier.
//
// THE MULTIPLIER IS NOW A FORMULA, NOT A TABLE (Economy v7). v6 tabled it, and the table was
// flat exactly where players live: R1 ×1.5, R2 ×2, R3 ×2.5, R4 ×3 … R10 ×10 — a first rebirth
// worth HALF a level's income, for wiping the whole level bar. Then it jumped a factor of ten
// per step from R11 (×100 … R20 ×1e11), a cliff nobody reaches. So the early steps did not pay
// for the reset and the late ones were meaningless.
// v7: mult = REBIRTH_MULT_BASE^rc, one clean exponential. R1 ×3 · R3 ×27 · R5 ×243 · R10
// ×59,049 · R20 ×3.49e9. Every step is the same MEANINGFUL factor, the first one triples your
// income, and there is no cliff to sit under.
// The LEVEL THRESHOLDS stay tabled (REBIRTH_TABLE below) - those are the published gates and
// they are unchanged; only the `mult` column is superseded by the formula.
// Everything EXCEPT xp survives a rebirth (wins, winsLifetime, owned, equipped, rounds).
export const REBIRTH_MULT_BASE = 3; // v8 (×3 per rebirth, compounding) — kept for the record
// v9: rebirth adds a flat +REBIRTH_MULT_STEP each time — ×2 at R1, ×11 at R10 (v8: ×59,049).
export const REBIRTH_MULT_STEP = 1;
export const REBIRTH_KEY = 'taw.rebirths';
// LEVELS ONLY. The `mult` column is retained so the published v6 table stays readable next to
// what replaced it, but NOTHING reads it any more - rebirthMult() is REBIRTH_MULT_BASE^rc.
export const REBIRTH_TABLE = [
  { level: 15, mult: 1.5 }, //   R1   (v7 pays ×3)
  { level: 25, mult: 2 }, //     R2   (×9)
  { level: 40, mult: 2.5 }, //   R3   (×27)
  { level: 60, mult: 3 }, //     R4   (×81)
  { level: 75, mult: 3.5 }, //   R5   (×243)
  { level: 100, mult: 4 }, //    R6   (×729)
  { level: 125, mult: 5 }, //    R7   (×2,187)
  { level: 150, mult: 6 }, //    R8   (×6,561)
  { level: 175, mult: 8 }, //    R9   (×19,683)
  { level: 200, mult: 10 }, //   R10  (×59,049)
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
// The published TABLE gate (pure; no grandfathering).
// REBIRTH GATE (Rebirth Rush): LV 15 + 18·R — R1 at LV15, R2 at LV33, R10 at LV195, R20 at LV375.
// (REBIRTH_TABLE above is the v6–v11 table, kept for the record.)
export const REBIRTH_GATE_BASE = 15;
export const REBIRTH_GATE_STEP = 18;
export function tableRebirthThreshold(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) && rebirthCount > 0 ? Math.floor(rebirthCount) : 0;
  return REBIRTH_GATE_BASE + REBIRTH_GATE_STEP * rc;
}

// PROGRESSION v10 must-fix 5 — the GRANDFATHERED rebirth gate. A save that existed when v10 landed may
// sit far below its next table gate on a curve that just got much steeper (Tangie R10 LV126 → R11 needs
// LV225). The v10 migration stores ONE lower gate for that save's NEXT rebirth:
//   taw.rbgate = {"rc": <rebirths at migration>, "lv": min(table gate, level at migration + 25)}
// It applies only while the rebirth count still equals `rc`, and doRebirth deletes it — used once.
export const REBIRTH_GATE_KEY = 'taw.rbgate';
export function grandfatheredGate() {
  try {
    const g = JSON.parse(localStorage.getItem(REBIRTH_GATE_KEY) || 'null');
    if (g && Number.isFinite(g.rc) && g.rc >= 0 && Number.isFinite(g.lv) && g.lv >= 1) {
      return { rc: Math.floor(g.rc), lv: Math.floor(g.lv) };
    }
  } catch {
    /* blocked / corrupt */
  }
  return null;
}
export function clearGrandfatheredGate() {
  try {
    localStorage.removeItem(REBIRTH_GATE_KEY);
  } catch {
    /* blocked */
  }
}
// The LEVEL required for the NEXT rebirth: the table gate, or the save's one-time grandfathered gate.
export function rebirthThreshold(rebirthCount) {
  const rc = Number.isFinite(rebirthCount) && rebirthCount > 0 ? Math.floor(rebirthCount) : 0;
  const table = tableRebirthThreshold(rc);
  const g = grandfatheredGate();
  return g && g.rc === rc && g.lv < table ? g.lv : table;
}
// The permanent XP+WINS multiplier AFTER `rebirthCount` rebirths: REBIRTH_MULT_BASE^rc, with
// rc=0 → ×1. v9: 1 + rc (R1 ×2, R10 ×11, R20 ×21) — see REBIRTH_MULT_STEP above. (v8 was 3^rc.)
export function rebirthMult(rebirthCount) {
  return rebirthPow(rebirthCount); // Rebirth Rush: ×5 wins per rebirth, the same 5^R as XP
}
// A flat wins reward scaled by the player's CURRENT rebirth multiplier — the ONE place both the
// grant and its on-screen quote go through, so Collection/Achievement payouts show exactly what
// they pay (a rebirthed player was quoted the base while being granted base × the multiplier).
export function rebirthScaledWins(base, rebirthCount = getRebirths()) {
  const b = Number.isFinite(base) ? base : 0;
  return Math.round(b * rebirthMult(rebirthCount));
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
// HEIRLOOM (MARKS via ROLLS — the SECRET ORIGIN perk): how many KEY tiers a rebirth KEEPS (0 = the Rebirth Rush
// reset to T0). Injected by wins.js (markPerks.rebirthKeyKeep) — the marks modules sit above this one.
let rebirthKeyKeep = () => 0;
export function setRebirthKeyKeep(fn) {
  if (typeof fn === 'function') rebirthKeyKeep = fn;
}
function keyTiersKept() {
  try {
    const k = Number(rebirthKeyKeep());
    return Number.isFinite(k) && k > 0 ? Math.floor(k) : 0;
  } catch {
    return 0;
  }
}
/** The KEY tier a rebirth leaves: T{min(T, kept)} — T0 unless the HEIRLOOM perk keeps tiers. What the rebirth
 *  screens quote, and exactly what doRebirth writes. */
export function keyTierAfterRebirth(tier = getKeyTier()) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 0;
  return Math.min(t, keyTiersKept());
}
// Perform a rebirth: zero XP, bump the rebirth count. Returns the new count.
// Wins/owned/equipped/rounds live under their own keys — untouched.
export function doRebirth() {
  // v10: the count is written FIRST so the fresh level state is stamped with the new rc (a stale-tab
  // check compares taw.rebirths against it), and the one-time grandfathered gate is spent.
  // The run's PEAK goes into taw.records.maxLevel BEFORE the level resets: mode unlocks (modeAccess.peakLevel)
  // and the Stats record read it, and under the Keyboard Escape loop every run ends in a rebirth.
  try {
    const peak = loadProgress().level;
    const rec = JSON.parse(localStorage.getItem('taw.records') || 'null') || {};
    if (!(Number.isFinite(rec.maxLevel) && rec.maxLevel >= peak)) {
      rec.maxLevel = peak;
      localStorage.setItem('taw.records', JSON.stringify(rec));
    }
  } catch {
    /* storage blocked / corrupt records — the rebirth still happens */
  }
  const rc = getRebirths() + 1;
  saveRebirths(rc);
  clearGrandfatheredGate();
  // Rebirth Rush: KEY → T0 every rebirth (wins kept — the rebuy spree); HEIRLOOM keeps up to 3 tiers
  saveKeyTier(keyTierAfterRebirth());
  saveProgress({ level: 1, intoLevel: 0 });
  pendingRebirth = rc;
  return rc;
}

// ---- Key Tier — DISCRETE TIERS (Economy v6) ------------------------------------------
// Tier stored at taw.keytier (int, default 0). Key Tier is no longer a per-level crawl with
// a doubler — it is a hardcoded TABLE of tiers, each a real one-at-a-time decision. `xp` is the
// XP PER LETTER granted at that tier; `cost` is the wins price to REACH that tier (T0 is the
// free start, so its cost is 0). Every cost is a round multiple of 10; effect values are the
// published figures and need NOT end in a zero (375, 5875, 14690). SURVIVES rebirth (its own
// key, untouched by doRebirth).
// PRICES /10 (Economy v8). Wins are now the word's XP divided by ten (wins.js), so the whole
// currency was restated an order of magnitude smaller and every price had to follow or the shop
// would have become ten times more expensive by accident. The ×6 ladder and the XP effect values
// are UNCHANGED — only the wins prices moved, and T1 lands on a clean 10 so the ladder is exactly
// 10 · 6^(t-1) (and therefore so is WORD SENSE, which reads keyTierCostAt).
//   T0   10 XP/letter    free (start)
//   T1   25              10 wins      (was 90)
//   T2   60              60           (540)
//   T3   150             360          (3,240)
//   T4   375             2,160        (19,440)
//   T5   940             12,960       (116,640)
//   T6   2,350           77,760       (699,840)
//   T7   5,875           466,560      (4,199,040)
//   T8   14,690          2,799,360    (25,194,240)
// (v8 history: past T8 the effect went ×2.5 and the cost ×6 a tier. v9 replaced both — below.)
export const KEYTIER_KEY = 'taw.keytier';
// KEY TIER — RESTORED TO v8 (Andy oct2 KP2: "keep it very close to the old one"). v9 made it +15 XP
// per letter a tier, priced in words — late tiers added ~10% and felt like nothing. Back to the v8
// ladder: XP per letter ×2.5 a tier, price ×6 a tier IN WINS (the T1–T8 table above, extended by those
// steps forever). T1 = 25. NO CAPS: past a double's range the numbers display through the named-suffix
// ladder (format.js) — tested at T60+. A save's tier NUMBER is kept, and v8 pays at least what v9 did
// at every tier (v9 = 10 + 15t; floored at it anyway — nobody's XP/letter drops).
export const KEY_TIERS = [
  { xp: 10, cost: 0 }, //          T0
  { xp: 25, cost: 10 }, //         T1
  { xp: 60, cost: 60 }, //         T2
  { xp: 150, cost: 360 }, //       T3
  { xp: 375, cost: 2160 }, //      T4
  { xp: 940, cost: 12960 }, //     T5
  { xp: 2350, cost: 77760 }, //    T6
  { xp: 5875, cost: 466560 }, //   T7
  { xp: 14690, cost: 2799360 }, // T8
];
export const TIER_XP_STEP = 2.5; // effect multiplier per tier past T8
export const TIER_COST_STEP = 6; // cost multiplier per tier past T8

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
// ×2.5 per tier from T8's 14,690, each step round10. Never below the v9 value at the same tier.
// Rebirth Rush: WINS no longer scale with KEY (KEY is the bar's booster). This is now the WINS BASIS of one
// letter in the old "XP" units the receipt multiplies (÷10 → wins): BASE 10 wins × length/5 = 2 wins a
// letter = 20. The argument is ignored; the name stays so the receipt / forge / roll-price callers don't change.
export const WINS_BASIS_PER_LETTER = 20;
export const WINS_BASE_PER_WORD = 10; // "BASE 10" wins: WINS_BASIS_PER_LETTER × 5 letters ÷ 10
// eslint-disable-next-line no-unused-vars
export function keyTierXp(tier) {
  return WINS_BASIS_PER_LETTER;
}
// The wins cost to REACH a given tier (T0 = 0). Within the table it's the published price; past T8
// it extends ×6 per tier from T8's 2,799,360, each step round10. (rebirthCount accepted and ignored —
// v8 prices were flat wins; the signature stays so callers don't change.)
// Rebirth Rush: T→T+1 costs KEY_COST_C0 × 6^T wins (CI probe round 3: the spec's ×5 with C0 60 ran ~50% fast; constants ±20% → ×6, C0 48) (C0 ≈ 30 s of BASE play: a median 10 words a minute ×
// BASE 10 × 6/5 letters ≈ 60 wins). NOT scaled by rebirth: wins are ×5 a rebirth and these prices are not,
// so every new run rebuys the early tiers in a burst. Cost to REACH tier t = C0 × 5^(t−1).
export const KEY_COST_C0 = 48;
export const KEY_COST_STEP = 6;
const KEY_COST_CAP = 1e300;
// eslint-disable-next-line no-unused-vars
export function keyTierCostAt(tier, rebirthCount) {
  const t = Number.isFinite(tier) && tier > 0 ? Math.floor(tier) : 0;
  if (t === 0) return 0;
  const v = KEY_COST_C0 * Math.pow(KEY_COST_STEP, t - 1);
  if (!Number.isFinite(v)) return KEY_COST_CAP;
  // every price a round multiple of 10 (48 · 6^(t−1) → 50, 290, 1,730 …) while that is still exact
  return Math.min(v < Number.MAX_SAFE_INTEGER ? Math.max(10, round10(v)) : v, KEY_COST_CAP);
}
// The wins cost to BUY the NEXT tier, standing at `tier` — i.e. the cost to REACH tier+1.
export function keyTierCost(tier, rebirthCount) {
  const t = Number.isFinite(tier) && tier >= 0 ? Math.floor(tier) : 0;
  return keyTierCostAt(t + 1, rebirthCount);
}

// THE RATE BOOST the shop prices the LETTER FORGE against (forge.js reads priceRateBoost). KEY TIER is
// back on fixed wins prices (v8), but the forge still prices "in words at your rate"; wins.js installs
// the real boost (forge average × STAR POWER) at load — injected, because those modules import this one.
let rateBoost = () => 1;
export function setRateBoost(fn) {
  if (typeof fn === 'function') rateBoost = fn;
}
export function priceRateBoost() {
  const b = rateBoost();
  return Number.isFinite(b) && b > 0 ? b : 1;
}

// (Level-ups no longer pay wins — wins come ONLY from finishing rounds. The old
// levelUpWins() payout was removed with Economy v3.)

// ---- MENU typing XP (v11: letters fill the bar) ----------------------------------------
// One menu keystroke is one letter at a FIFTH of a game letter's price: MENU 2 XP / LETTER × KEY × rebirth ×
// mark (game letters: BASE 10). Review round 3 (CI, 08af3404): at half price the loop-sim MASHER bot (12/s
// menu gibberish, no wins) reached ×2.46 the median's level-ups at 10 min. Why not 0.3 / 0.25: menu XP is
// rounded to WHOLE XP, so both give 3 XP a key at T0 R0, and at 3 XP the masher still clears the LV15 gate
// (R1, ×2 XP) inside 10 minutes — the arithmetic check puts it at ~24 level-ups vs the median's ~13 (×1.85).
// At 2 XP a key it is still climbing LV1→15 at minute 10 (~13 ups, ×1.0), and it only falls further behind
// as the player's wins buy KEY tiers. The median BOT is not the unfair side: it plays from minute 0 (no
// dialogs or tutorials are modelled), at 10 words / min including round overhead — what a real median player
// types in games — while the masher types 720 letters a minute.
// COSMETICS NEVER MULTIPLY LEVEL XP (round 2): pop styles / sound packs are looks only. `popMult`,
// `soundMult`, `mode` and `streakMult` are accepted for old callers and ignored. Whole XP.
export const MENU_LETTER_SHARE = 0.2; // a menu letter = a fifth of a game letter ("MENU 2 XP / LETTER")
// eslint-disable-next-line no-unused-vars
export function xpPerInput({ mode = 'menu', keyTier, rebirthCount, popMult = 1, soundMult = 1, streakMult, markMult = 1, baseAdd } = {}) {
  return Math.max(1, roundWordXp(levelXpPerLetter(keyTier, rebirthCount, markMult, baseAdd) * MENU_LETTER_SHARE));
}

// Apply a credited award. Pure: takes and returns the {level, intoLevel} shape (Economy v5 — level
// is stored EXACTLY, xpIntoLevel only ever holds progress within the current level so the persisted
// number never approaches MAX_SAFE_INTEGER). Adds the gain to intoLevel and carries whole levels
// forward via need(); reports whether a boundary was crossed so the caller can fire the one-shot
// celebration. (The old rawKeys arg only fed the removed lifetimeLetters counter — it is gone.)
//
// A state may carry `frac` (the fraction into the level — what is STORED, v10+). When it does, the XP
// into the level is frac × need(level). v11: need() is one fixed curve, so `frac` and `into` agree for
// every save; the third argument (v10's power P) is accepted and ignored. The carry is guarded: it stops
// on a non-finite/non-positive need or a non-finite total, and after CREDIT_LOOP_MAX levels.
export const CREDIT_LOOP_MAX = 1e6;
// eslint-disable-next-line no-unused-vars
export function creditXp(state, xpGain, _ignoredPower) {
  let level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  let cost = needAt(level);
  let intoLevel;
  if (state && typeof state.frac === 'number' && !Number.isNaN(state.frac)) intoLevel = clampFrac(state.frac) * cost;
  else intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
  const gain = Number.isFinite(xpGain) && xpGain > 0 ? xpGain : 0;
  const beforeLevel = level;
  intoLevel += gain;
  // Carry whole levels forward — guarded (must-fix 2).
  let guard = 0;
  while (Number.isFinite(cost) && cost > 0 && Number.isFinite(intoLevel) && intoLevel >= cost && guard < CREDIT_LOOP_MAX) {
    intoLevel -= cost;
    level += 1;
    cost = needAt(level);
    guard += 1;
  }
  const frac = clampFrac(cost > 0 ? intoLevel / cost : 0);
  if (!(Number.isFinite(intoLevel) && intoLevel >= 0 && intoLevel < cost)) intoLevel = intoOf(frac, cost);
  const next = { level, intoLevel, frac };
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

// XP granted for one accepted word — THE ONE PLACE A WORD'S VALUE IS COMPUTED. Pure given its
// factors (mode/keyTier/rebirth/streak default to live). `wordLength` is the menu-equivalent letter
// count; `weight` is the capped per-word reward mult. Snapped to WHOLE XP (roundWordXp, below) —
// NOT round10 any more — so wins (this ÷ 10, wins.js) are exact to a tenth of a win.
//
// `difficultyMult` and `bonusMult` are the two pass-throughs the unified stack needs and this
// module cannot resolve itself: DIFFICULTY (it lives in wins.js, next to the tier keys) and the
// aggregate BONUS (momentum × mark × mastery — momentum.js imports this file, so importing it back
// would be a cycle). They arrive as resolved numbers from perWordFactors(), which is the single
// definition of both. Default ×1, so every pure caller and unit test is unchanged.
//
// PROGRESSION v11: this is the WINS product (in tenths of a win: wins = this ÷ 10) and it is UNCHANGED —
// KEY ×2.5 a tier, rebirth ×(1+R), every bonus. It never moves the level bar: game words pay WINS ONLY,
// and the bar fills from LETTERS typed (levelXpPerLetter above, letterXp.js).
export function xpPerWord({
  mode = 'menu',
  keyTier,
  rebirthCount,
  wordLength = 1,
  weight = 1,
  streakMult,
  difficultyMult = 1,
  bonusMult = 1,
  baseWinsAdd = 0,
} = {}) {
  // REBIRTH RUSH (FROZEN formula): WINS / word = BASE 10 × length/5 × MODE POWER × REBIRTH 5^R × MARK × BOOST
  // (× FRENZY on FUSE) — in the ×10 "XP" units the receipt divides back to wins. KEY no longer touches wins;
  // streak and difficulty are accepted and IGNORED (not in the formula). `weight` (rarity × combo × lucky) is
  // ignored HERE: this is the per-word UNIT; Word Bomb + Blitz pay the weight as a BOOST factor by banking the
  // cumulative weight × this unit (wins.js bankWordWins / WEIGHTED_MODES). Never XP per letter.
  void keyTier; void weight; void streakMult; void difficultyMult;
  const rc = Number.isFinite(rebirthCount) ? rebirthCount : getRebirths();
  const len = Number.isFinite(wordLength) && wordLength > 0 ? Math.floor(wordLength) : 1;
  const bm = Number.isFinite(bonusMult) && bonusMult > 0 ? bonusMult : 1;
  // MARKS v2: a worn +N BASE WINS/WORD mark makes BASE 10 → 10 + N (before every multiplier): × (10 + N) / 10
  const ba = Number.isFinite(baseWinsAdd) && baseWinsAdd > 0 ? baseWinsAdd : 0;
  const base = keyTierXp() * ((WINS_BASE_PER_WORD + ba) / WINS_BASE_PER_WORD);
  return roundWordXp(finiteCap(base * len * modePower(mode) * rebirthMult(rc) * bm)); // never Infinity → 0
}

// THE PER-WORD GRID: WHOLE XP, not round10. ANDY: "nothing hidden." round10 was the grid here
// until fix/payout-honesty, and it swallowed small multipliers whole: a 100-XP / 10-win word with
// MOMENTUM ×1.01..×1.04 snapped straight back to 100, and ×1.05 landed on 100 too (half-to-even),
// so the first NINE marks the shop sold as "+1%" changed nothing that was awarded. One XP is the
// finest grid that stays an integer, and it is fine enough that every mark moves a 10-win word
// (100 → 101 → 102 …). Wins are this ÷ 10, so a word is now worth whole TENTHS of a win; the
// balance stays an integer and the tenths carry forward (wins.js bankWordWins) — nothing rounded
// away, nothing invented. toPrecision first so float noise (100 × 1.05 = 105.00000000000001, or
// 12.5 arriving as 12.499999…) cannot tip the rounding. Shared with the receipt (payout.js).
export function roundWordXp(x) {
  const v = Number.isFinite(x) ? x : 0;
  return Math.round(Number(v.toPrecision(12)));
}

// awardWordXp LIVES IN wins.js NOW (Economy v8). The grant is no longer XP-only: one accepted
// word is ONE award event with one multiplier stack, read out as XP and as wins (= XP ÷ 10). The
// function that performs it therefore has to see momentum and the mark's wins effect, and
// momentum.js imports this file — so the award sits downstream, in wins.js, and this module stays
// the pure XP model it was written to be.

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

// ---- Persistence — PROGRESSION v10 storage (must-fix 1) -------------------------------------------
// taw.xp holds {lv, f, rc, v:10}: the level (an exact integer), the FRACTION into it (0 ≤ f < 1), the
// rebirth count when it was written, and the shape version. The XP number the bar shows is
// f × need(lv) and is NEVER stored — so a change of power P (a KEY buy, AUTO-KEY, a rebirth, a restore
// of a higher- or lower-tier save) can never move the bar: need() moves, the fraction stays.
// PROGRESSION v11 keeps this shape EXACTLY ({lv, f, rc, v:10}, same shadow): only need() changed, and
// because f is a fraction a v10 save keeps its level AND its bar position under the new curve. A stale
// v10 tab still writes this same shape (its level gains are SLOWER than v11's, so it can never farm).
//
// Every write also goes to a SHADOW key (taw.xpv10). A stale tab or an old cached bundle on the same
// localStorage still writes the legacy {lv, into} shape to taw.xp on the OLD curve (LV400 in 18 min);
// once this browser is stamped v10 (taw.econ ≥ 10) such a write never raises the level — the shadow is
// kept, and only a rebirth done there (taw.rebirths > shadow.rc) is honoured.
//
// LEGACY shapes are detected by SHAPE (no v:10), never by the taw.econ stamp alone, and converted ONCE
// against the frozen v9 curve: f = clamp(into / needV9(lv), 0, 1 − 1e-9). Never zeroed, only clamped.
// Every access is wrapped: a storage-blocked/absent environment reads back the fresh LV1 state.
export const XP_KEY = 'taw.xp';
export const XP_SHADOW_KEY = 'taw.xpv10';
export const XP_SHAPE_VERSION = 10;
// The econ version stamp (owned by econMigrate.js; named here because this module can't import it).
export const ECON_STAMP_KEY = 'taw.econ';
export const FRAC_MAX = 1 - 1e-9;

/** Clamp a level fraction into [0, 1 − 1e-9]. NaN/negative → 0, ≥ 1 or Infinity → just under 1. */
export function clampFrac(f) {
  if (!(f > 0)) return 0;
  return Math.min(f, FRAC_MAX);
}
// The XP into a level shown for a fraction (display only; float noise trimmed so 100 reads as 100).
function intoOf(frac, cost) {
  const v = clampFrac(frac) * (Number.isFinite(cost) && cost > 0 ? cost : 0);
  return Number.isFinite(v) ? Number(v.toPrecision(12)) : 0;
}

function parseJson(raw) {
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
function toCount(raw) {
  const n = Number(raw);
  return raw != null && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
/** Is a parsed taw.xp value the v10 shape? */
export function isV10Shape(p) {
  return !!p && typeof p === 'object' && p.v === XP_SHAPE_VERSION && Number.isFinite(p.lv) && p.lv >= 1;
}
function fromV10(p) {
  return { level: Math.max(1, Math.floor(p.lv)), frac: clampFrac(p.f), rc: toCount(p.rc) };
}

/**
 * Convert a LEGACY parsed taw.xp ({lv, into} or a bare cumulative number) to {level, frac} against the
 * frozen v9 curve. Returns null for anything that is not a legacy save (absent, garbage, or v10).
 */
export function convertLegacyXp(parsed) {
  if (typeof parsed === 'number') {
    if (!Number.isFinite(parsed) || parsed <= 0) return { level: 1, frac: 0 };
    const d = levelFromXp(parsed);
    return { level: d.level, frac: clampFrac(d.frac) };
  }
  if (parsed && typeof parsed === 'object' && !isV10Shape(parsed) && Number.isFinite(parsed.lv)) {
    const level = Math.max(1, Math.floor(parsed.lv));
    const into = Number.isFinite(parsed.into) && parsed.into > 0 ? parsed.into : 0;
    const c = needV9(level);
    return { level, frac: clampFrac(Number.isFinite(c) && c > 0 ? into / c : 0) };
  }
  return null;
}

/**
 * THE authoritative level state from a key getter (localStorage, or a save blob's keys) — PURE, no
 * writes. Returns { level, frac, rc, source } where source is:
 *   'v10'           taw.xp is the v10 shape (authoritative)
 *   'legacy'        a legacy shape that has not been converted yet (no v10 stamp, or no shadow)
 *   'stale'         a legacy write AFTER the v10 stamp — the shadow is kept (never raises the level)
 *   'stale-rebirth' as 'stale', but a rebirth happened there: its level is taken, never above the shadow
 *   'shadow'        taw.xp missing/corrupt after the stamp — the shadow is kept
 *   'fresh'         nothing stored
 */
export function resolveXpState(get) {
  const g = (k) => {
    try {
      return get(k);
    } catch {
      return null;
    }
  };
  const parsed = parseJson(g(XP_KEY));
  if (isV10Shape(parsed)) return { ...fromV10(parsed), source: 'v10' };
  const legacy = convertLegacyXp(parsed);
  const stamp = Number(g(ECON_STAMP_KEY));
  const shadow = parseJson(g(XP_SHADOW_KEY));
  const rcNow = toCount(g(REBIRTH_KEY));
  if (stamp >= XP_SHAPE_VERSION && isV10Shape(shadow)) {
    const sh = fromV10(shadow);
    if (legacy && rcNow > sh.rc) {
      // A rebirth was done in the stale bundle: honour it (the level restarted), never above the shadow.
      if (legacy.level < sh.level) return { level: legacy.level, frac: legacy.frac, rc: rcNow, source: 'stale-rebirth' };
      return { level: sh.level, frac: 0, rc: rcNow, source: 'stale-rebirth' };
    }
    return { ...sh, source: legacy ? 'stale' : 'shadow' };
  }
  if (legacy) return { ...legacy, rc: rcNow, source: 'legacy' };
  return { level: 1, frac: 0, rc: rcNow, source: 'fresh' };
}

function storageGet(k) {
  return localStorage.getItem(k);
}

// Read the authoritative {level, frac}; a legacy/stale taw.xp is rewritten in the v10 shape once.
function readLevelState() {
  let s;
  try {
    s = resolveXpState(storageGet);
  } catch {
    return { level: 1, frac: 0 };
  }
  if (s.source !== 'v10' && s.source !== 'fresh') writeLevelState(s.level, s.frac, s.rc);
  return { level: s.level, frac: s.frac };
}

function writeLevelState(level, frac, rc) {
  try {
    const v = JSON.stringify({
      lv: Math.max(1, Math.floor(level)),
      f: clampFrac(frac),
      rc: Number.isFinite(rc) && rc >= 0 ? Math.floor(rc) : getRebirths(),
      v: XP_SHAPE_VERSION,
    });
    localStorage.setItem(XP_KEY, v);
    localStorage.setItem(XP_SHADOW_KEY, v);
  } catch {
    /* storage blocked */
  }
}

/** The authoritative stored level (a cheap read for the board, claims, the cloud score). */
export function storedLevel() {
  return readLevelState().level;
}

// The model shape { level, intoLevel, frac }: `frac` is authoritative, `intoLevel` = frac × need(level)
// at the CURRENT power (display). Callers that only know {level, intoLevel} still work everywhere.
export function loadProgress() {
  const { level, frac } = readLevelState();
  return { level, intoLevel: intoOf(frac, need(level)), frac };
}

// Persist a model state. `frac` wins when present; otherwise it is intoLevel / need(level) now.
export function saveProgress(state) {
  const level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  let frac;
  if (state && typeof state.frac === 'number' && !Number.isNaN(state.frac)) frac = clampFrac(state.frac);
  else {
    const intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
    const cost = need(level);
    frac = clampFrac(cost > 0 ? intoLevel / cost : 0);
  }
  writeLevelState(level, frac);
  // GEMS: every level write is where a level-up lands (menu typing, game letters, a rebirth's reset) — the level
  // ACTUALLY stored (a stale-tab write may be refused) pays LEVEL_UP past the save's high-water mark (gems.js).
  noteLevelReached(storedLevel());
}

// The display-progress object for a model state: the level, XP into it, that level's cost, the
// remainder, and the 0..1 fill fraction for the bar. `frac` wins when present (v10), so the bar never
// moves when P changes; a bare {level, intoLevel} is read against need() now.
// v11: need() reads no storage; the second argument (v10's power) is accepted and ignored.
// eslint-disable-next-line no-unused-vars
export function progressOf(state, _ignoredPower) {
  const level = Number.isFinite(state && state.level) && state.level >= 1 ? Math.floor(state.level) : 1;
  const cost = need(level);
  let frac;
  if (state && typeof state.frac === 'number' && !Number.isNaN(state.frac)) frac = clampFrac(state.frac);
  else {
    const intoLevel = Number.isFinite(state && state.intoLevel) && state.intoLevel > 0 ? state.intoLevel : 0;
    frac = clampFrac(cost > 0 ? intoLevel / cost : 0);
  }
  const intoLevel = intoOf(frac, cost);
  return { level, intoLevel, cost, toNext: Math.max(0, cost - intoLevel), frac };
}
