// markRollsCore.js — the part of MARK ROLLS the PAYOUT and the MENU need on boot: the pool, the stored
// state, the MARK STATS (markWinsMult / markXpMult / markBaseWins / markBaseXp / markLuck / markOverdriveSec — what
// wins.js, letterXp.js, markRolls.luck and overdrive.js read) and the worn-mark helpers (the menu chip). Split out of
// markRolls.js so the rest of the roll system (odds, pity, luck, price, migration, rolling) loads only with the MARKS
// panel (payload ratchet, PR #156). markRolls.js re-exports all of this, so its importers are unchanged. Pure + a
// guarded read/write of one storage key.
//
// MARKS v2 (Andy oct5 — Genshin stats, ★ pips). GEAR POOL v2 (Andy oct9: "remove the common ones entirely … make epic a
// 1 in 10 pity and legendary a 1 in 50"): FIVE tiers, RARE is the floor (Genshin's 3★ floor — a roll never lands on
// trash). The tier odds:
//   RARE = the remainder (98.59%) · EPIC 1 IN 100 · LEGENDARY 1 IN 250 (+ perk) · MYTHIC 1 IN 10,000 (+ perk) ·
//   SECRET 1 IN 100,000 (+ game-changing perks).
// RARE absorbed the old COMMON share; EPIC / LEGENDARY / MYTHIC / SECRET keep their exact 1-IN-X (and so their odds
// relative to each other). The "1 IN X" is the TIER's chance; each mark in a tier splits it evenly. PITY (markRolls):
// EPIC+ at least every 10 rolls, LEGENDARY+ at least every 50.
// Each rollable mark has ONE MAIN STAT {kind, value} (claude/econ-oct2/marks-v2.md, + the GEAR POOL v2 kinds):
//   winsPct  +N% WINS            xpPct    +N% XP
//   baseWins +N BASE WINS/WORD   (BASE 10 → 10 + N, before every multiplier)
//   baseXp   +N BASE XP/LETTER   (BASE 10 → 10 + N, before every multiplier)
//   luckPct  +N% ROLL LUCK       overdriveSec  +N s OVERDRIVE
//   <mode>WinsPct  +N% WINS IN ONE MODE (wb / blitz / sat / chain / fuse / race) — 2× the tier's all-mode percent
//   critRatePct    +N% CRIT RATE (the worn MAIN's crit rate on MENU keys, inside the 50% cap)
//   critPower      +N× CRIT POWER (added to the ×2 a crit key pays)
//   critEvery      EVERY Nth MENU KEY IS A GUARANTEED CRIT (★ pips / SHINY shorten N)
// sized so the tier's effect on what it touches ≈ the old MAIN (RARE +25%, EPIC +50%, LEGENDARY +200%, MYTHIC +900%,
// SECRET +2,400%; season 2 re-sizes them to +40 / +80 / +180 / +400 / +900 — v3/hooks.applyFinalMarkTiers, GEAR OP). Only the
// WORN MAIN's stat applies. No two gears print the same MAIN stat (markRolls.test.js keeps it that way).
// DUPES → ★ PIPS (replacing GOLD / RAINBOW): RARE 5 / EPIC 3 / LEGENDARY 2 / MYTHIC+ 1 dupes per pip, ★5
// max; each pip +20% of the stat (★5 = ×2). SHINY ×2 on top. A save from before v2 keeps its GOLD (×2) / RAINBOW
// (×5) as a floor (`k`), so no mark ever got weaker. The INDEX (% collected) keeps its small bonus (+0.5% per %,
// on wins AND XP).
import { MARKS, MARK_TIERS, MARKS_EQUIPPED_KEY, MARKS_OWNED_KEY } from './marks.js';
import { grantGems } from './gemsCore.js'; // a leaf: the COMMON refund goes through the one gem door
import { MARK_PERKS, PERKS, MARK_ROLLS_STORE_KEY, CRIT_PERK_EVERY, REMOVED_COMMON_IDS, RETIRED_COMMON_IDS } from './markPerks.js';
import { formatNum, formatRate, formatMultExact } from '../format.js';
const xMult = (m) => `×${formatMultExact(m)}`; // exact: a ×1.05 never prints as ×1.1
// PROGRESSION v3 (SEASON2, default OFF): the R5 unlock "2nd MARK slot" — a second worn mark (v3/store mark2Id)
// whose +N% WINS / +N% XP stat multiplies too. MINIMAL MODEL ONLY (phase 3): its flat BASE / LUCK / OVERDRIVE stats
// do not apply, and the slot's UI is the visual PR's. OFF = only the one worn mark, exactly as before.
import { V3 } from './season.js'; // V3.m = the 2nd MARK slot (v3/hooks.js mark2Factor), installed in season 2 only

export const ROLL_STATE_KEY = MARK_ROLLS_STORE_KEY; // 'taw.markRolls'
export const ROLL_STATE_VERSION = 3; // v3 = GEAR POOL v2: COMMON removed (owned commons refunded — migrateRollSave)

// ---------------------------------------------------------------------------------------- tiers
export const ROLL_TIER_ORDER = ['rare', 'epic', 'legendary', 'mythic', 'secret', 'permanent'];
export const ROLLABLE_TIERS = ['rare', 'epic', 'legendary', 'mythic', 'secret'];
/** The FLOOR tier: it takes whatever the rarer tiers leave, and LUCK never scales it (luck removes it). */
export const FLOOR_TIER = 'rare';
/** The rarer tiers' "1 IN X" (Andy's table). RARE (the floor) is the remainder — see the header. */
export const TIER_ODDS = { epic: 100, legendary: 250, mythic: 10000, secret: 100000 }; // LEGENDARY 1,000 → 250 (Andy oct8: "legendary should land more often")
/** The tier's equivalent multiplier ("strength") at ★0. Mirrors marks.js MARK_TIERS (1 + bonus). */
export const TIER_MAIN = { rare: 1.25, epic: 1.5, legendary: 3, mythic: 10, secret: 25 };
/** The same, as the stat's percent (the part above ×1) — kept exact (1.1 − 1 is not 0.1 in floats). */
export const TIER_PCT = { rare: 25, epic: 50, legendary: 200, mythic: 900, secret: 2400 };
export function tierRank(tier) {
  const i = ROLL_TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}
// MAIN bonus (the part above ×1) at ★0. PERMANENT (the hard-achievement marks) pays the LEGENDARY MAIN on wins
// AND XP. Read at call time, not import time: marks.js → claims.js → wins.js → this module is a cycle.
export function mainBonus(tier) {
  const t = tier === 'permanent' ? 'legendary' : tier;
  return (MARK_TIERS[t] || { bonus: 0 }).bonus;
}

// ---------------------------------------------------------------------------------------- stats
// GEAR POOL v2: one WINS kind per mode (payout key → kind), so a mode gear is its own stat (never a twin of another).
export const MODE_WINS_KINDS = Object.freeze({
  wordBomb: 'wbWinsPct', blitz: 'blitzWinsPct', satRush: 'satWinsPct', chain: 'chainWinsPct', fuse: 'fuseWinsPct', wordRace: 'raceWinsPct',
});
const MODE_OF_KIND = Object.fromEntries(Object.entries(MODE_WINS_KINDS).map(([m, k]) => [k, m]));
/** The payout mode a <mode>WinsPct kind pays in (wins.js PAYOUT_MODES key), or null for any other kind. */
export const modeOfKind = (kind) => MODE_OF_KIND[kind] || null;
/** What the card calls each mode ("×1.5 WINS IN WORD BOMB"). */
export const MODE_NAMES = Object.freeze({ wordBomb: 'WORD BOMB', blitz: 'BLITZ', satRush: 'SAT RUSH', chain: 'CHAIN', fuse: 'FUSE', wordRace: 'RACE' });
export const STAT_KINDS = [
  'winsPct', 'xpPct', 'baseWins', 'baseXp', 'luckPct', 'overdriveSec', ...Object.values(MODE_WINS_KINDS),
  'critRatePct', 'critPower', 'critEvery',
];
export const BASE_WINS_PER_WORD = 10; // "BASE 10" wins on a 5-letter word (xp.js WINS_BASIS_PER_LETTER × 5 ÷ 10)
export const BASE_XP_PER_LETTER = 10; // xp.js LEVEL_XP_PER_LETTER
export const OVERDRIVE_BASE_SEC = 300; // overdrive.js OVERDRIVE_MIN × 60
export const MODE_WINS_SCALE = 2; // a one-mode WINS stat is 2× the tier's all-mode percent (it only pays in one mode)
export const CRIT_POWER_PER_PCT = 1 / 25; // +1× CRIT POWER per 25% of tier (RARE +1×, EPIC +2×, season-2 LEGENDARY +4×)
export const CRIT_EVERY_BASIS = 100; // EVERY Nth KEY: N = 100 ÷ tier % (RARE: every 4th key — ×2 on 1 key in 4 = +25%)
/** A stat's ★0 value for a tier: the tier's percent on what it touches. */
export function statBaseValue(kind, tier) {
  const p = TIER_PCT[tier] || 0;
  if (kind === 'baseWins') return (BASE_WINS_PER_WORD * p) / 100;
  if (kind === 'baseXp') return (BASE_XP_PER_LETTER * p) / 100;
  if (kind === 'overdriveSec') return (OVERDRIVE_BASE_SEC * p) / 100;
  if (MODE_OF_KIND[kind]) return MODE_WINS_SCALE * p;
  if (kind === 'critPower') return p * CRIT_POWER_PER_PCT;
  if (kind === 'critEvery') return p > 0 ? Math.max(1, Math.round(CRIT_EVERY_BASIS / p)) : 0;
  return p;
}
/**
 * A stat's value after the ★ pips × SHINY factor `k` — the ONE scaling rule statOf (so the card, the sheet and the
 * payout) uses. critEvery is a GAP (fewer keys between crits is better): N ÷ k, whole keys, ≥ 1. critRatePct stops
 * at the crit cap (a gear never prints a rate the cap would not pay). Everything else: value × k.
 */
export function scaleStat(kind, value, k = 1) {
  const f = Number.isFinite(k) && k > 0 ? k : 1;
  if (kind === 'critEvery') return Math.max(1, Math.round(value / f));
  if (kind === 'critRatePct') return Math.min(value * f, CRIT_RATE_CAP_PCT);
  return value * f;
}
const CRIT_RATE_CAP_PCT = 50; // = CRIT_RATE_CAP × 100 (below; a test keeps them equal)

// ---------------------------------------------------------------------------------------- pool
// mode = payout key (wins.js PAYOUT_MODES) or null for ALL-MODE. For a <mode>WinsPct gear the mode IS the stat (it
// pays only there); for the rest it is flavour. `legacy` = the id already exists in marks.js (its owners keep it and
// its marks.js entry). `perks` come from markPerks.js (LEGENDARY+ only). `stat` = the ONE MAIN stat kind — every
// gear's (kind, ★0 value) is unique across the pool (markRolls.test.js).
const RAW_POOL = [
  // ---- RARE (12): the floor ----
  { id: 'mk-detonator', name: 'DETONATOR', tier: 'rare', mode: 'wordBomb', stat: 'wbWinsPct' },
  { id: 'mk-cyclone', name: 'CYCLONE', tier: 'rare', mode: 'blitz', stat: 'baseWins' },
  { id: 'mk-scholar', name: 'SAVANT', tier: 'rare', mode: 'satRush', legacy: true, stat: 'xpPct' },
  { id: 'mk-ouroboros', name: 'OUROBOROS', tier: 'rare', mode: 'chain', stat: 'baseXp' },
  { id: 'mk-tinder', name: 'TINDER', tier: 'rare', mode: 'fuse', stat: 'overdriveSec' },
  { id: 'mk-slipstream', name: 'SLIPSTREAM', tier: 'rare', mode: 'wordRace', stat: 'luckPct' },
  { id: 'mk-smith', name: 'SMITH', tier: 'rare', modes: ['satRush', 'chain'], legacy: true, stat: 'winsPct' },
  { id: 'mk-phoenix', name: 'PHOENIX', tier: 'rare', mode: null, legacy: true, stat: 'critRatePct' },
  { id: 'mk-metronome', name: 'METRONOME', tier: 'rare', mode: null, legacy: true, stat: 'critEvery' },
  { id: 'mk-hotwire', name: 'HOTWIRE', tier: 'rare', mode: 'wordRace', stat: 'raceWinsPct' },
  { id: 'mk-grapple', name: 'GRAPPLE', tier: 'rare', mode: 'chain', stat: 'chainWinsPct' },
  { id: 'mk-sparkplug', name: 'SPARKPLUG', tier: 'rare', mode: null, stat: 'critPower' },
  // ---- EPIC (7) ----
  { id: 'mk-pyro', name: 'PYRO', tier: 'epic', mode: 'fuse', legacy: true, stat: 'baseWins' },
  { id: 'mk-nova', name: 'NOVA', tier: 'epic', mode: null, legacy: true, stat: 'winsPct' },
  { id: 'mk-golem', name: 'GOLEM', tier: 'epic', mode: null, stat: 'baseXp' },
  { id: 'mk-brainstorm', name: 'BRAINSTORM', tier: 'epic', mode: 'blitz', stat: 'blitzWinsPct' },
  { id: 'mk-flashpoint', name: 'FLASHPOINT', tier: 'epic', mode: 'fuse', stat: 'fuseWinsPct' },
  { id: 'mk-voltage', name: 'VOLTAGE', tier: 'epic', mode: null, stat: 'critPower' },
  { id: 'mk-talisman', name: 'TALISMAN', tier: 'epic', mode: null, stat: 'luckPct' },
  // ---- LEGENDARY (4) + perk ----
  { id: 'mk-leviathan', name: 'LEVIATHAN', tier: 'legendary', mode: null, stat: 'xpPct' },
  { id: 'mk-eclipse', name: 'ECLIPSE', tier: 'legendary', mode: null, stat: 'winsPct' },
  { id: 'mk-headmaster', name: 'HEADMASTER', tier: 'legendary', mode: 'satRush', stat: 'satWinsPct' },
  { id: 'mk-thunderclap', name: 'THUNDERCLAP', tier: 'legendary', mode: null, stat: 'critPower' },
  // ---- MYTHIC (3) + perks (every MYTHIC+ gear also carries FREE OVERDRIVE — markPerks.js) ----
  { id: 'mk-singularity', name: 'SINGULARITY', tier: 'mythic', mode: null, stat: 'baseWins' },
  { id: 'mk-kraken', name: 'KRAKEN', tier: 'mythic', mode: null, stat: 'baseXp' },
  { id: 'mk-hydra', name: 'HYDRA', tier: 'mythic', mode: 'wordBomb', stat: 'wbWinsPct' },
  // ---- SECRET (1) + game-changing perks ----
  { id: 'mk-origin', name: 'ORIGIN', tier: 'secret', mode: null, stat: 'winsPct' },
];
// GEAR POOL v2: the 12 COMMON gears that were removed (each owned copy refunds COMMON_REFUND_GEMS — migrateRollSave),
// and the three marks.js-only COMMONS (the retired ALL-MODE marks) that went with them.
// (The lists live in the markPerks.js LEAF so v3/achievements.js can drop them from FILL INDEX without a cycle.)
export { REMOVED_COMMON_IDS, RETIRED_COMMON_IDS };
export const COMMON_REFUND_GEMS = 15;

function buildPool() {
  const count = {};
  for (const m of RAW_POOL) count[m.tier] = (count[m.tier] || 0) + 1;
  // every rarer tier is exact: each of its k marks is 1 IN (k × X); the FLOOR (RARE) shares the rest evenly
  const rarer = Object.keys(TIER_ODDS).filter((t) => count[t]);
  const rest = 1 - rarer.reduce((s, t) => s + 1 / TIER_ODDS[t], 0);
  const xFloor = (count[FLOOR_TIER] || 1) / rest;
  return RAW_POOL.map((m) => ({
    id: m.id,
    name: m.name,
    tier: m.tier,
    x: m.tier === FLOOR_TIER ? xFloor : count[m.tier] * TIER_ODDS[m.tier],
    mode: m.modes ? null : m.mode,
    modes: m.modes || (m.mode ? [m.mode] : null), // null = every mode
    legacy: !!m.legacy,
    perks: MARK_PERKS[m.id] || [],
    stat: Object.freeze({ kind: m.stat, value: statBaseValue(m.stat, m.tier) }), // ★0, not shiny
  }));
}
export const ROLL_MARKS = buildPool();
const ROLL_BY_ID = new Map(ROLL_MARKS.map((m) => [m.id, m]));
export function rollMarkById(id) {
  return ROLL_BY_ID.get(id) || null;
}
/** "1 IN X" exactly as the card prints it (whole number, X ≥ 1). */
export function oneInX(id) {
  const m = ROLL_BY_ID.get(id);
  return m ? Math.max(1, Math.round(m.x)) : null;
}
/** The player's own odds for a mark at a luck value ("YOUR ODDS 1 IN …"). The FLOOR (RARE) is not luck-scaled. */
export function yourOneInX(id, luckValue = 1) {
  const m = ROLL_BY_ID.get(id);
  if (!m) return null;
  if (m.tier === FLOOR_TIER) return oneInX(id);
  return Math.max(1, Math.round(m.x / Math.max(1, luckValue)));
}

// ---------------------------------------------------------------------------------- permanents
// One PERMANENT mark per KEPT achievement. The four that already exist keep their id, art and owners; six are
// new. `from` is the achievement id. MAIN = LEGENDARY (×3) on wins AND XP (they are not rolled, so no stat).
export const PERMANENT_MARKS = [
  { id: 'mk-ironhand', name: 'IRONHAND', from: 'vol-10k' },
  { id: 'mk-marathon', name: 'MARATHON', from: 'vol-50k' },
  { id: 'mk-blaze', name: 'BLAZE', from: 'wpm-100', retired: true }, // Andy oct8: the 100 WPM task is gone; owners keep BLAZE
  { id: 'mk-curator', name: 'ARCHIVIST', from: 'dist-2500', legacy: true }, // H6/M8: the achievement is CURATOR
  { id: 'mk-legend', name: 'LEGEND', from: 'lv-300', legacy: true },
  { id: 'mk-ritual', name: 'RITUALIST', from: 'streak-30' },
  { id: 'mk-linguist', name: 'LINGUIST', from: 'sec-dict', legacy: true },
  { id: 'mk-eternal', name: 'ETERNAL', from: 'sec-eternal', legacy: true },
  { id: 'mk-grandmaster', name: 'GRANDMASTER', from: 'sec-truemaster' },
  { id: 'mk-omega', name: 'OMEGA', from: 'sec-completionist' },
].map((m) => ({ ...m, tier: 'permanent' }));
const PERM_BY_ID = new Map(PERMANENT_MARKS.map((m) => [m.id, m]));
export function permanentMarkById(id) {
  return PERM_BY_ID.get(id) || null;
}

// ---------------------------------------------------------------------------------------- ★ pips
/** Dupes per ★ pip, by tier (Andy oct5). */
export const DUPES_PER_PIP = { rare: 5, epic: 3, legendary: 2, mythic: 1, secret: 1 };
export const MAX_PIPS = 5;
export const PIP_STEP = 0.2; // each pip +20% of the stat → ★5 = ×2
// v1 finishes, kept as a floor for saves from before v2 (GOLD doubled the bonus part, RAINBOW ×5 it).
export const LEGACY_GOLD_K = 2;
export const LEGACY_RAINBOW_K = 5;
const LEGACY_DUPES_PER_GOLD = 10;
const LEGACY_GOLDS_PER_RAINBOW = 10;
// SHINY (Andy, rolls-live): any roll has a flat 1.5% chance to come up SHINY — independent of LUCK and pity. A mark
// is shiny once ANY copy of it rolled shiny (kept forever). Shiny ×2 THAT mark's stat, stacking with the pips.
// Perks don't scale (they're on/off), so shiny doesn't touch them.
export const SHINY_CHANCE = 0.015;
export const SHINY_MULT = 2;
// The INDEX: % of the rollable marks owned pays a small permanent bonus — +0.5% per % collected (+50% at 100%), on
// wins AND XP. Kept (small) rather than folded away: removing it would make every collector's payout drop.
export const INDEX_BONUS_PER_PCT = 0.005;
// INDEX milestones: % of the rollable marks owned (base), at ★1+ (gold track) and at ★5 (rainbow track) → LUCK. The
// ids keep their v1 names (they are stored). v2: LUCK only — the wins lump moved to the per-mark INDEX rewards below.
export const COLLECTION_MILESTONES = [
  { id: 'base-25', track: 'base', pct: 25, luck: 0.05 },
  { id: 'base-50', track: 'base', pct: 50, luck: 0.1 },
  { id: 'base-75', track: 'base', pct: 75, luck: 0.1 },
  { id: 'base-90', track: 'base', pct: 90, luck: 0.15 },
  { id: 'base-100', track: 'base', pct: 100, luck: 0.25 },
  { id: 'gold-25', track: 'gold', pct: 25, luck: 0.1 },
  { id: 'gold-50', track: 'gold', pct: 50, luck: 0.15 },
  { id: 'gold-75', track: 'gold', pct: 75, luck: 0.15 },
  { id: 'gold-100', track: 'gold', pct: 100, luck: 0.25 },
  { id: 'rainbow-25', track: 'rainbow', pct: 25, luck: 0.15 },
  { id: 'rainbow-50', track: 'rainbow', pct: 50, luck: 0.2 },
  { id: 'rainbow-75', track: 'rainbow', pct: 75, luck: 0.2 },
  { id: 'rainbow-100', track: 'rainbow', pct: 100, luck: 0.5 },
];
// INDEX REWARDS (Andy oct5): words at your rate (markRolls.refWordWins), paid through the one grant path.
export const INDEX_NEW_WORDS = { rare: 30, epic: 100, legendary: 500, mythic: 2500, secret: 10000 };
export const INDEX_PIP_WORDS = { rare: 15, epic: 50, legendary: 250, mythic: 1250, secret: 5000 };
export const INDEX_COMPLETE_WORDS = { rare: 300, epic: 500, legendary: 2000, mythic: 10000, secret: 25000 };
// "Skip reveals below [tier]": RARE is the floor, so "< RARE" skips nothing (the first step of the stepper).
export const SKIP_TIERS = ['rare', 'epic', 'legendary', 'mythic', 'secret'];
export const DEFAULT_SKIP_BELOW = 'epic';
// PITY, Genshin-style (Andy oct9: "make epic a 1 in 10 pity and legendary a 1 in 50"): EPIC-or-better guaranteed at
// least every 10 rolls, LEGENDARY-or-better at least every 50; each counter resets when its tier (or better) drops.
// Was EPIC+ 50 (soft from 40, first by 10) / LEGENDARY+ 125. markRolls.PITY reads these; here because normalize
// clamps the stored counters to them.
export const EPIC_PITY_HARD = 10;
export const LEGENDARY_PITY_HARD = 50;

// --------------------------------------------------------------------------------------- state
export function freshState() {
  return {
    v: ROLL_STATE_VERSION, rolls: 0, sinceEpic: 0, sinceLegendary: 0, everEpic: false, marks: {}, milestones: [],
    starter: false, skipBelow: DEFAULT_SKIP_BELOW, done: [],
  };
}
export const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
function legacyK(n) {
  const gold = Math.floor(Math.max(0, n - 1) / LEGACY_DUPES_PER_GOLD);
  if (Math.floor(gold / LEGACY_GOLDS_PER_RAINBOW) > 0) return LEGACY_RAINBOW_K;
  return gold > 0 ? LEGACY_GOLD_K : 0;
}
const tierComplete = (marks, tier) => ROLL_MARKS.filter((m) => m.tier === tier).every((m) => marks[m.id] && marks[m.id].n > 0);
/**
 * Repair any input into a valid v2 state (unknown ids dropped, counters clamped ≥ 0). Pure. A state from before v2
 * (no `v` or v < 2) is MIGRATED: each mark's GOLD / RAINBOW becomes its floor `k`, the LEGENDARY+ pity starts from
 * the rolls since (≤ 499 — a save that never hit one is close to the guarantee, never past it), and every tier it
 * already completed counts as paid.
 */
export function normalize(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  const old = !(Number(raw.v) >= 2);
  s.rolls = num(raw.rolls);
  s.sinceEpic = num(raw.sinceEpic);
  s.everEpic = !!raw.everEpic;
  s.starter = !!raw.starter;
  if (SKIP_TIERS.includes(raw.skipBelow)) s.skipBelow = raw.skipBelow;
  if (raw.marks && typeof raw.marks === 'object') {
    for (const [id, v] of Object.entries(raw.marks)) {
      const o = v && typeof v === 'object' ? v : {};
      const n = num(v && typeof v === 'object' ? v.n : v);
      if (!ROLL_BY_ID.has(id) || n <= 0) continue;
      const e = { n };
      if (o.shiny === true) e.shiny = true; // old states have no shiny flag → not shiny
      const k = old ? legacyK(n) : num(o.k);
      if (k >= LEGACY_GOLD_K) e.k = Math.min(k, LEGACY_RAINBOW_K);
      const first = num(o.first);
      if (first > 0) e.first = first;
      s.marks[id] = e;
    }
  }
  if (Array.isArray(raw.milestones)) s.milestones = [...new Set(raw.milestones.filter((id) => COLLECTION_MILESTONES.some((m) => m.id === id)))];
  if (old) {
    const hasTop = Object.keys(s.marks).some((id) => tierRank(ROLL_BY_ID.get(id).tier) >= tierRank('legendary'));
    s.sinceLegendary = hasTop ? 0 : Math.min(s.rolls, LEGENDARY_PITY_HARD - 1);
    s.done = ROLLABLE_TIERS.filter((t) => tierComplete(s.marks, t));
  } else {
    s.sinceLegendary = num(raw.sinceLegendary);
    s.done = Array.isArray(raw.done) ? ROLLABLE_TIERS.filter((t) => raw.done.includes(t)) : [];
  }
  // PITY IS A PROMISE (GEAR POOL v2): a drought carried from the old ladder (EPIC+ 50 / LEGENDARY+ 125) is kept, capped
  // one short of the new guarantee — so a save that was past 10 / 50 gets its guaranteed roll NEXT, never a reset.
  s.sinceEpic = Math.min(s.sinceEpic, EPIC_PITY_HARD - 1);
  s.sinceLegendary = Math.min(s.sinceLegendary, LEGENDARY_PITY_HARD - 1);
  // the one-line INDEX note of the COMMON refund (migrateRollSave), until the INDEX shows it once
  const n = raw.note && typeof raw.note === 'object' ? raw.note : null;
  if (n && num(n.commons) > 0) s.note = { commons: num(n.commons), gems: num(n.gems) };
  return s;
}

// ---------------------------------------------------------------------------- GEAR POOL v2 migration
/**
 * PURE. What removing COMMON takes from a save: { copies, gems, ids } — every owned copy of a removed COMMON gear
 * (the roll state's count, or 1 for a marks.js-owned COMMON the roll state never counted) refunds
 * COMMON_REFUND_GEMS. `raw` = the stored roll state (any shape; a v3+ state has no commons left to count),
 * `ownedIds` = taw.marksOwned as stored, `wornId` = taw.mark. `unequip` = the worn MAIN was a COMMON.
 * Idempotent by construction: its own output (a v3 state, the owned list without commons) refunds 0.
 */
export function commonRefund(raw, { ownedIds = [], wornId = null } = {}) {
  const all = new Set([...REMOVED_COMMON_IDS, ...RETIRED_COMMON_IDS]);
  const marks = raw && typeof raw === 'object' && raw.marks && typeof raw.marks === 'object' ? raw.marks : {};
  const pre = !(raw && Number(raw.v) >= 3);
  const by = {};
  if (pre) {
    for (const id of REMOVED_COMMON_IDS) {
      const v = marks[id];
      const n = num(v && typeof v === 'object' ? v.n : v);
      if (n > 0) by[id] = n;
    }
  }
  for (const id of Array.isArray(ownedIds) ? ownedIds : []) if (all.has(id) && !by[id]) by[id] = 1;
  const copies = Object.values(by).reduce((t, n) => t + n, 0);
  return { copies, gems: copies * COMMON_REFUND_GEMS, ids: Object.keys(by), unequip: !!(wornId && all.has(wornId)) };
}
function readRawJson(key) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? null : JSON.parse(v);
  } catch {
    return null;
  }
}
/**
 * ONCE PER SAVE, at boot (main.jsx, before the first render): retire COMMON. Owned COMMON gears are deleted (the roll
 * state drops them; marks.js's owned set loses them), each copy refunds COMMON_REFUND_GEMS through the ONE gem door
 * (grantGems 'refund'), a worn COMMON MAIN (or 2nd slot) is unequipped, and the roll state is stamped v3 with a
 * `note` the INDEX prints once. Idempotent: a second run finds nothing to refund and writes nothing. Guarded.
 * Returns the refund ({ copies, gems, ids, unequip }) or null when there was nothing to do.
 */
export function migrateRollSave() {
  try {
    const raw = readRawJson(ROLL_STATE_KEY);
    const owned = readRawJson(MARKS_OWNED_KEY);
    let worn = null;
    try { worn = localStorage.getItem(MARKS_EQUIPPED_KEY); } catch { worn = null; }
    const r = commonRefund(raw, { ownedIds: owned, wornId: worn });
    const stale = raw && typeof raw === 'object' && !(Number(raw.v) >= ROLL_STATE_VERSION);
    if (!r.copies && !r.unequip && !stale) return null;
    if (raw && typeof raw === 'object') {
      const s = normalize(raw);
      if (r.copies > 0) s.note = { commons: r.copies, gems: r.gems };
      saveRollState(s);
    } else if (r.copies > 0) {
      saveRollState({ ...freshState(), note: { commons: r.copies, gems: r.gems } });
    }
    if (Array.isArray(owned) && r.ids.length) {
      const drop = new Set([...REMOVED_COMMON_IDS, ...RETIRED_COMMON_IDS]);
      try { localStorage.setItem(MARKS_OWNED_KEY, JSON.stringify(owned.filter((id) => !drop.has(id)))); } catch { /* blocked */ }
    }
    if (r.unequip) {
      try { localStorage.removeItem(MARKS_EQUIPPED_KEY); } catch { /* blocked */ }
    }
    try {
      const id2 = V3.store && V3.store.mark2Id ? V3.store.mark2Id() : null;
      if (id2 && (REMOVED_COMMON_IDS.includes(id2) || RETIRED_COMMON_IDS.includes(id2))) V3.store.saveMark2Id(null);
    } catch { /* no season 2 */ }
    if (r.gems > 0) grantGems(r.gems, 'refund', { detail: 'common-retired' });
    return r.copies || r.unequip ? r : null;
  } catch {
    return null;
  }
}
/** The INDEX printed the COMMON refund note: forget it (it shows once). */
export function clearRollNote() {
  const s = loadRollState();
  if (!s || !s.note) return;
  const { note, ...rest } = s; // eslint-disable-line no-unused-vars
  saveRollState(rest);
}

/**
 * One mark's copies and ★ pips. { copies, dupes, pips (0–5), have (dupes toward the next pip), need (dupes per pip;
 * 0 at ★5), k (the pre-v2 GOLD/RAINBOW floor, 0 = none), variant ('base' when owned, else null) }. Uncapped counts.
 */
export function markLevel(state, id) {
  const e = state && state.marks && state.marks[id];
  const n = num(e && e.n);
  const dupes = Math.max(0, n - 1);
  const m = ROLL_BY_ID.get(id);
  const per = (m && DUPES_PER_PIP[m.tier]) || DUPES_PER_PIP.rare;
  const pips = Math.min(MAX_PIPS, Math.floor(dupes / per));
  const max = pips >= MAX_PIPS;
  const k = num(e && e.k);
  return { copies: n, dupes, pips, have: max ? 0 : dupes - pips * per, need: max ? 0 : per, k: k >= LEGACY_GOLD_K ? k : 0, variant: n > 0 ? 'base' : null };
}
/**
 * The card's ★ line ("7/10 → ★3"): { pips, have, need } — `have` dupes of the `need` per pip toward ★(pips + 1);
 * at ★5 { pips: 5, have: 0, need: 0 }. null for an id that is not rollable. `state` omitted → the stored one.
 */
export function pipProgress(id, state) {
  if (!ROLL_BY_ID.has(id)) return null;
  const s = state === undefined ? loadRollState() : state;
  const lv = markLevel(s, id);
  return { pips: lv.pips, have: lv.have, need: lv.need };
}
/** What the ★ pips do to the stat: 1 + 20% a pip (★5 = ×2), never below the pre-v2 GOLD/RAINBOW floor. */
export function pipMult(level) {
  if (!level) return 1;
  return Math.max(1 + PIP_STEP * num(level.pips), level.k || 1);
}

/** True once any copy of this mark rolled SHINY (kept forever). Pure. */
export function isShiny(markId, state) {
  const v = state && state.marks && markId ? state.marks[markId] : null;
  return !!(v && typeof v === 'object' && v.shiny === true && num(v.n) > 0);
}
/** What SHINY does to the stat: ×2 when the mark is shiny, else ×1. */
export function shinyMult(markId, state) {
  return isShiny(markId, state) ? SHINY_MULT : 1;
}

/** The INDEX: base / ★1+ (gold) / ★5 (rainbow) % over the rollable pool. */
export function collection(state) {
  const total = ROLL_MARKS.length;
  let base = 0;
  let gold = 0;
  let rainbow = 0;
  for (const m of ROLL_MARKS) {
    const lv = markLevel(state, m.id);
    if (lv.copies > 0) base++;
    if (lv.pips > 0 || lv.k >= LEGACY_GOLD_K) gold++;
    if (lv.pips >= MAX_PIPS || lv.k >= LEGACY_RAINBOW_K) rainbow++;
  }
  const pct = (k) => (k / total) * 100;
  return { total, base, gold, rainbow, pct: pct(base), goldPct: pct(gold), rainbowPct: pct(rainbow) };
}
/** The INDEX's permanent bonus: 1 + 0.5% per % collected (×1 on a save that has never rolled). */
export function indexMult(state) {
  if (!state) return 1;
  return 1 + INDEX_BONUS_PER_PCT * collection(state).pct;
}

function tierOfAny(id) {
  const r = ROLL_BY_ID.get(id) || PERM_BY_ID.get(id);
  if (r) return r.tier;
  const l = MARKS.find((m) => m.id === id);
  return l ? l.tier : null;
}
const resolve = (state) => (state === undefined ? loadRollState() : state);
/**
 * A mark's STAT as it pays right now: { kind, value } = its ★0 value × the pips (or the pre-v2 floor) × SHINY.
 * null for an id with no stat (a PERMANENT or a retired mark — those pay their tier MAIN on wins AND XP).
 * `state` = the roll state its pips are read from (omit → the stored one; null → ★0).
 */
export function statOf(id, state) {
  const m = ROLL_BY_ID.get(id);
  if (!m) return null;
  const s = resolve(state);
  const k = s ? pipMult(markLevel(s, id)) * shinyMult(id, s) : 1;
  return { kind: m.stat.kind, value: scaleStat(m.stat.kind, m.stat.value, k) };
}
/** "4TH" — an English ordinal for the EVERY Nth KEY stat. */
export function ordinal(n) {
  const v = Math.max(1, Math.floor(n));
  const t = v % 100;
  const suf = t >= 11 && t <= 13 ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' })[v % 10] || 'TH';
  return `${formatNum(v)}${suf}`;
}
/**
 * The stat as the card prints it, NAMED and short (Andy oct5): a % stat reads as the multiplier it pays — "×1.1 WINS",
 * "×1.25 XP", "×1.5 ROLL LUCK" — a flat one as "+2.5 BASE WINS", "+0.5 BASE XP", "+30s OVERDRIVE". '' for none.
 * A BASE stat names no unit (Andy oct9: "no need to say xp/letter or wins/word — for bases just say xp or win").
 */
export function statText(stat) {
  if (!stat) return '';
  const v = stat.value;
  const x = (pct) => xMult(1 + pct / 100);
  switch (stat.kind) {
    case 'winsPct': return `${x(v)} WINS`;
    case 'xpPct': return `${x(v)} XP`;
    // exact to 2 decimals (formatMultExact): a season-2 RARE +2.5 BASE XP adds 0.25 — formatRate printed it as 0.3
    case 'baseWins': return `+${formatMultExact(v)} BASE WINS`;
    // SEASON 2 (Andy oct8: "an epic +10 base doesn't make sense — it should be added to the normal base, which is just
    // 1"): the XP base is 1 XP / KEY and a +N BASE mark scales it by (10 + N)/10 — so its REAL addition to the base is
    // N/10 (EPIC +5 → +0.5 = ×1.5, LEGENDARY +10 → +1 = ×2, exactly its tier's MAIN). Say that number, on that unit.
    case 'baseXp': return `+${formatMultExact(V3 && V3.ready ? v / 10 : v)} BASE XP`;
    case 'luckPct': return `${x(v)} ROLL LUCK`;
    case 'overdriveSec': return `+${formatNum(v)}s OVERDRIVE`;
    // GEAR POOL v2: the one-mode WINS, the crit MAIN stats, the EVERY Nth KEY crit
    case 'critRatePct': return `+${formatRate(v)}% CRIT RATE`;
    case 'critPower': return `+${formatMultExact(v)}× CRIT POWER`;
    case 'critEvery': return v <= 1 ? 'EVERY KEY CRITS' : `EVERY ${ordinal(v)} KEY CRITS`;
    default: {
      const mode = MODE_OF_KIND[stat.kind];
      return mode ? `${x(v)} WINS IN ${MODE_NAMES[mode]}` : '';
    }
  }
}
export function statLine(id, state) {
  return statText(statOf(id, state));
}
/**
 * A mark's STRENGTH: the equivalent multiplier on what its stat touches — 1 + tier bonus × pips × SHINY. Every stat
 * is sized to its tier, so this ranks marks across kinds (auto-equip compares it, upgrade-only). A PERMANENT /
 * retired mark: its tier MAIN (it pays that on wins AND XP).
 */
export function mainMultOf(id, state) {
  const tier = id ? tierOfAny(id) : null;
  if (!tier) return 1;
  const s = resolve(state);
  const k = ROLL_BY_ID.has(id) && s ? pipMult(markLevel(s, id)) * shinyMult(id, s) : 1;
  return 1 + mainBonus(tier) * k;
}
/** ONE tag for a mark: its stat line (a rolled mark), or "×N WINS + XP" (a PERMANENT / retired mark pays both). */
export function mainTag(id, state) {
  if (ROLL_BY_ID.has(id)) return statLine(id, state);
  return `${xMult(mainMultOf(id, state))} WINS + XP`;
}
/** The perk line(s) of a mark ("LETTERS COUNT ×2"), or '' when it has none. */
export function perkLine(id) {
  const m = ROLL_BY_ID.get(id);
  return m && m.perks.length ? m.perks.map((p) => (PERKS[p] ? PERKS[p].line : p)).join(' + ') : '';
}
/**
 * A non-worn owned card's ONE tag (rule U): its PERK when it has one, else its stat. A perk only runs while its
 * mark is the worn MAIN (markPerks.js), so a non-worn card's perk reads "WEAR: …", never as already on.
 */
export function perkTag(state, id) {
  const p = perkLine(id);
  return p ? `WEAR: ${p}` : mainTag(id, state);
}

const PERK_TIERS = new Set(['legendary', 'mythic', 'secret']);
/**
 * The COMPACT mark line (Andy oct5) — the roll result, the MAIN chip and the INDEX cards all print this: the named stat,
 * then "PERK: …" on a LEGENDARY+ mark that has one, then "★N" once it has pips. "×1.5 WINS · PERK: LETTERS COUNT ×2 · ★2".
 * { perk: false } drops the perk (the small menu chip).
 */
export function markTag(id, state, { perk = true } = {}) {
  const out = [mainTag(id, state)];
  const tier = id ? tierOfAny(id) : null;
  const p = perk && PERK_TIERS.has(tier) ? perkLine(id) : '';
  if (p) out.push(`PERK: ${p}`);
  const s = ROLL_BY_ID.has(id) ? resolve(state) : null;
  const pips = s ? markLevel(s, id).pips : 0;
  if (pips > 0) out.push(`★${formatNum(pips)}`);
  return out.filter(Boolean).join(' · ');
}

let cacheRaw;
let cacheState = null;
/** The stored roll state (migrated on first read), or null on a save that has never rolled. */
export function loadRollState() {
  let raw;
  try {
    raw = localStorage.getItem(ROLL_STATE_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  if (raw === cacheRaw) return cacheState;
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  cacheRaw = raw;
  cacheState = normalize(parsed);
  return cacheState;
}
export function saveRollState(state) {
  try {
    localStorage.setItem(ROLL_STATE_KEY, JSON.stringify(state));
  } catch {
    /* blocked */
  }
}
// ------------------------------------------------------------------------------- UI read helpers
/**
 * The worn MAIN as stored (taw.mark), accepting a ROLLED id the save owns. marks.js getEquippedMark()
 * only knows the legacy ids, so a worn rolled mark would read as "nothing worn" on the menu.
 */
export function wornMarkId() {
  let raw = null;
  try {
    raw = localStorage.getItem(MARKS_EQUIPPED_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  if (MARKS.some((m) => m.id === raw)) return raw;
  const s = loadRollState();
  return s && s.marks[raw] && ROLL_BY_ID.has(raw) ? raw : null;
}
/**
 * A display entry for ANY mark id ({ id, name, tier, blurb }) — the marks.js entry for a legacy id,
 * else the rolled/permanent one. `blurb` is the ONE tag (rule U), so the menu chip's title stays short.
 */
export function markEntry(id) {
  const l = MARKS.find((m) => m.id === id);
  if (l) return l;
  const r = ROLL_BY_ID.get(id) || PERM_BY_ID.get(id);
  return r ? { id: r.id, name: r.name, tier: r.tier === 'permanent' ? 'legendary' : r.tier, blurb: mainTag(r.id) } : null;
}

// ------------------------------------------------------------------------------- THE MARK STATS
// What the WORN MAIN pays, by what it touches. `markId` undefined → the worn mark; null → nothing worn. `state`
// undefined → the stored roll state. Guarded: a storage failure is ×1 / +0.
function worn({ markId, state } = {}) {
  const s = resolve(state);
  const id = markId === undefined ? wornMarkId() : markId;
  return { s, id, stat: id ? statOf(id, s) : null };
}
function guard(fn, fallback) {
  try {
    const v = fn();
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
/** Does a worn stat pay on `kind` here? A one-mode WINS stat (GEAR POOL v2) pays as WINS only in its own mode
 *  (`opts.mode` = the payout key, wins.js modeKey — the menu / an unknown mode never matches). */
export function statHits(stat, kind, opts = {}) {
  if (!stat) return false;
  if (stat.kind === kind) return true;
  return kind === 'winsPct' && !!opts.mode && stat.kind === MODE_WINS_KINDS[opts.mode];
}
function pctMult(kind, opts) {
  const { s, id, stat } = worn(opts);
  // a PERMANENT / retired mark (no stat) pays its tier MAIN on wins AND XP, as before v2
  const main = stat ? (statHits(stat, kind, opts) ? 1 + stat.value / 100 : 1) : mainMultOf(id, s);
  const v = main * indexMult(s) * (V3.m ? V3.m(kind, opts, s, id) : 1);
  return v > 0 ? v : 1;
}
/** × on WINS: a worn +N% WINS mark (or a PERMANENT's MAIN) × the INDEX. ×1 with nothing worn, never rolled. `mode`
 *  (a wins.js payout key) also lets a one-mode WINS gear pay in its mode. */
export function markWinsMult(opts = {}) {
  return guard(() => pctMult('winsPct', opts), 1);
}
/** × on XP per letter: a worn +N% XP mark (or a PERMANENT's MAIN) × the INDEX. */
export function markXpMult(opts = {}) {
  return guard(() => pctMult('xpPct', opts), 1);
}
const flat = (kind, opts) => guard(() => {
  const { stat } = worn(opts);
  return stat && stat.kind === kind ? stat.value : 0;
}, 0);
/** +N BASE WINS/WORD (added to BASE 10 before every multiplier). */
export function markBaseWins(opts = {}) {
  return flat('baseWins', opts);
}
/** +N BASE XP/LETTER (added to BASE 10 before every multiplier). */
export function markBaseXp(opts = {}) {
  return flat('baseXp', opts);
}
/** + roll LUCK (additive, like every luck source: +10% → +0.1). */
export function markLuck(opts = {}) {
  return flat('luckPct', opts) / 100;
}
/** + seconds of OVERDRIVE. */
export function markOverdriveSec(opts = {}) {
  return flat('overdriveSec', opts);
}
/**
 * THE MARK on WINS as ONE number (wins-equivalent): markWinsMult × (BASE 10 + markBaseWins) / 10. Kept for the
 * readers that want one number (the price rate boost, the sims). The payout itself reads the parts.
 */
export function markMult(opts = {}) {
  return guard(() => markWinsMult(opts) * ((BASE_WINS_PER_WORD + markBaseWins(opts)) / BASE_WINS_PER_WORD), 1);
}

// ------------------------------------------------------------------------------------------ CRIT
// CRIT (Andy oct8: "add crit power and crit rate to gears — gears can have more than 1 value"). A gear keeps its ONE
// MAIN stat and, from RARE up, carries EXTRA crit stats by tier — deterministic per gear (no save field, no migration),
// scaled by the SAME ★ pips × SHINY factor statOf uses. EARNED (permanent) gears carry the LEGENDARY crit, as they pay
// the LEGENDARY MAIN. A crit is a MENU KEY that pays × CRIT POWER (progress/crit.js rolls it, useXpCapture applies it).
//   RARE +3% RATE · EPIC +6%, +0.5× POWER · LEGENDARY +9%, +1× · MYTHIC +14%, +2× · SECRET +20%, +3×
//   (GEAR OP, Andy oct9 "a bit more OP": was RARE +2% · EPIC +4%, +0.25× · LEGENDARY +6%, +0.5× · MYTHIC +9%, +1× · SECRET +12%, +1.5×)
// Totals SUM over the worn gears (the MAIN + the season-2 2nd slot): RATE = min(50%, Σ rate) from a BASE of 0,
// POWER = ×2 + Σ power. `rate` is a fraction (0.06 = 6%); `power` is the part ADDED to the base ×2.
export const CRIT_BY_TIER = Object.freeze({
  rare: Object.freeze({ rate: 0.03, power: 0 }),
  epic: Object.freeze({ rate: 0.06, power: 0.5 }),
  legendary: Object.freeze({ rate: 0.09, power: 1 }),
  mythic: Object.freeze({ rate: 0.14, power: 2 }),
  secret: Object.freeze({ rate: 0.2, power: 3 }),
});
export const CRIT_BASE_RATE = 0.01; // Andy oct9: "people should have a 1% crit chance to start" (×2 power) — gear adds on top
export const CRIT_BASE_POWER = 2;
export const CRIT_RATE_CAP = 0.5;
const NO_CRIT = Object.freeze({ rate: 0, power: 0 });
/** The crit tier row a gear id reads (a PERMANENT reads LEGENDARY), or null for an id with no crit (a retired mark). */
export function critTierOf(id) {
  const r = ROLL_BY_ID.get(id);
  if (r) return CRIT_BY_TIER[r.tier] || NO_CRIT;
  return PERM_BY_ID.has(id) ? CRIT_BY_TIER.legendary : null;
}
/**
 * ONE gear's EXTRA crit stats as they pay right now: { rate, power } = its tier's row × ★ pips × SHINY (a PERMANENT:
 * the LEGENDARY row, no pips). { 0, 0 } for an unknown or retired id. `state` as statOf.
 */
export function critStatsOf(id, state) {
  const row = id ? critTierOf(id) : null;
  if (!row || (!row.rate && !row.power)) return { rate: 0, power: 0 };
  let k = 1;
  if (ROLL_BY_ID.has(id)) {
    const s = resolve(state);
    k = s ? pipMult(markLevel(s, id)) * shinyMult(id, s) : 1;
  }
  return { rate: row.rate * k, power: row.power * k };
}
/**
 * The worn gears' CRIT, summed: { rate (capped 50%), power (×2 + Σ), rawRate (uncapped Σ), every, ids }. `markId`
 * undefined → the worn MAIN; `mark2Id` undefined → the season-2 2nd slot (V3.c2 — null outside season 2 / below R5);
 * null = none. `state` undefined → the stored roll state. Guarded: a failure is the base (1% · ×2).
 * GEAR POOL v2: the worn MAIN's crit MAIN stat adds here too (+N% CRIT RATE / +N× CRIT POWER), and `every` is the
 * guaranteed-crit gap (EVERY Nth MENU KEY CRITS — the MAIN's critEvery stat or the THUNDERCLAP perk's 10; 0 = none).
 */
export function critTotals({ markId, mark2Id, state } = {}) {
  try {
    const s = resolve(state);
    const id = markId === undefined ? wornMarkId() : markId;
    const id2 = mark2Id === undefined ? (V3.c2 ? V3.c2(s, id) : null) : mark2Id;
    let rate = CRIT_BASE_RATE;
    let power = 0;
    const ids = [];
    for (const g of [id, id2]) {
      if (!g || ids.includes(g)) continue;
      const c = critStatsOf(g, s);
      ids.push(g);
      rate += c.rate;
      power += c.power;
    }
    const main = id ? statOf(id, s) : null; // only the worn MAIN's MAIN stat applies (the 2nd slot: WINS / XP only)
    let every = 0;
    if (main && main.kind === 'critRatePct') rate += main.value / 100;
    if (main && main.kind === 'critPower') power += main.value;
    if (main && main.kind === 'critEvery') every = main.value;
    // the THUNDERCLAP perk (markPerks critKey10) — only while that gear is the worn MAIN of THIS read
    if (id && (MARK_PERKS[id] || []).includes('critKey10') && s && s.marks && s.marks[id]) every = every ? Math.min(every, CRIT_PERK_EVERY) : CRIT_PERK_EVERY;
    const r = Number.isFinite(rate) && rate > 0 ? rate : 0;
    const p = Number.isFinite(power) && power > 0 ? power : 0;
    return { rate: Math.min(CRIT_RATE_CAP, r), power: CRIT_BASE_POWER + p, rawRate: r, every, ids };
  } catch {
    return { rate: CRIT_BASE_RATE, power: CRIT_BASE_POWER, rawRate: CRIT_BASE_RATE, every: 0, ids: [] };
  }
}
