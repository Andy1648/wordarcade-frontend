// markRollsCore.js — the part of MARK ROLLS the PAYOUT and the MENU need on boot: the pool, the stored
// state, the MAIN math, markMult() (THE one MARK number — wins.js AND letterXp.js read it) and the worn-mark
// helpers (the menu chip). Split out of markRolls.js so the rest of the roll system (odds, pity, luck, price,
// migration, rolling) loads only with the MARKS panel (payload ratchet, PR #156). markRolls.js re-exports all
// of this, so its importers are unchanged. Pure + a guarded read/write of one storage key.
//
// MARKS via ROLLS (Andy, PROGRESSION FINAL): six tiers —
//   COMMON 1 IN 2 ×1.1 · RARE 1 IN 10 ×1.25 · EPIC 1 IN 100 ×1.5 · LEGENDARY 1 IN 1,000 ×3 + perk ·
//   MYTHIC 1 IN 10,000 ×10 + perk · SECRET 1 IN 100,000 ×25 + game-changing perk.
// The "1 IN X" is the TIER's chance; each mark in a tier splits it evenly. COMMON takes whatever the five rarer
// tiers leave (1 − 0.1111 = 88.9%) — the rarer tiers are EXACT, because they are the chase (1/2 + 1/10 + … can't
// also sum to 1). The worn MAIN multiplies XP per letter AND wins; dupes go GOLD (bonus ×2) then RAINBOW (bonus ×5);
// the INDEX (% collected) pays a small permanent bonus on top.
import { MARKS, MARK_TIERS, MARKS_EQUIPPED_KEY } from './marks.js';
import { MARK_PERKS, PERKS, MARK_ROLLS_STORE_KEY } from './markPerks.js';

export const ROLL_STATE_KEY = MARK_ROLLS_STORE_KEY; // 'taw.markRolls'
export const ROLL_STATE_VERSION = 1;

// ---------------------------------------------------------------------------------------- tiers
export const ROLL_TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'secret', 'permanent'];
/** The TIER's "1 IN X" (Andy's table). COMMON is the remainder — see the header. */
export const TIER_ODDS = { common: 2, rare: 10, epic: 100, legendary: 1000, mythic: 10000, secret: 100000 };
/** The MAIN multiplier a worn mark pays, by tier (base finish). Mirrors marks.js MARK_TIERS (1 + bonus). */
export const TIER_MAIN = { common: 1.1, rare: 1.25, epic: 1.5, legendary: 3, mythic: 10, secret: 25 };
export function tierRank(tier) {
  const i = ROLL_TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}
// MAIN bonus (the part above ×1) when worn, at base finish. PERMANENT (the hard-achievement marks) pays the
// LEGENDARY MAIN — rarest by how you get it, not a bigger number. Read at call time, not import time:
// marks.js → claims.js → wins.js → this module is a cycle.
export function mainBonus(tier) {
  const t = tier === 'permanent' ? 'legendary' : tier;
  return (MARK_TIERS[t] || MARK_TIERS.common).bonus;
}

// ---------------------------------------------------------------------------------------- pool
// mode = payout key (wins.js PAYOUT_MODES) or null for ALL-MODE — flavour only now (the MAIN pays in every mode).
// `legacy` = the id already exists in marks.js (its owners keep it and its marks.js entry). `perks` come from
// markPerks.js (LEGENDARY+ only).
const RAW_POOL = [
  // ---- COMMON (12): two per mode ----
  { id: 'mk-bomber', name: 'BOMBER', tier: 'common', mode: 'wordBomb', legacy: true },
  { id: 'mk-sparky', name: 'SPARKY', tier: 'common', mode: 'wordBomb' },
  { id: 'mk-sprinter', name: 'SPRINTER', tier: 'common', mode: 'blitz', legacy: true },
  { id: 'mk-dasher', name: 'DASHER', tier: 'common', mode: 'blitz' },
  { id: 'mk-crammer', name: 'CRAMMER', tier: 'common', mode: 'satRush' },
  { id: 'mk-inkwell', name: 'INKWELL', tier: 'common', mode: 'satRush' },
  { id: 'mk-linker', name: 'LINKER', tier: 'common', mode: 'chain', legacy: true },
  { id: 'mk-shackle', name: 'SHACKLE', tier: 'common', mode: 'chain' },
  { id: 'mk-wick', name: 'WICK', tier: 'common', mode: 'fuse' },
  { id: 'mk-matchstick', name: 'MATCHSTICK', tier: 'common', mode: 'fuse' },
  { id: 'mk-pacer', name: 'PACER', tier: 'common', mode: 'wordRace' },
  { id: 'mk-nitro', name: 'NITRO', tier: 'common', mode: 'wordRace' },
  // ---- RARE (9): one per mode + the three legacy rares ----
  { id: 'mk-detonator', name: 'DETONATOR', tier: 'rare', mode: 'wordBomb' },
  { id: 'mk-cyclone', name: 'CYCLONE', tier: 'rare', mode: 'blitz' },
  { id: 'mk-scholar', name: 'SAVANT', tier: 'rare', mode: 'satRush', legacy: true },
  { id: 'mk-ouroboros', name: 'OUROBOROS', tier: 'rare', mode: 'chain' },
  { id: 'mk-tinder', name: 'TINDER', tier: 'rare', mode: 'fuse' },
  { id: 'mk-slipstream', name: 'SLIPSTREAM', tier: 'rare', mode: 'wordRace' },
  { id: 'mk-smith', name: 'SMITH', tier: 'rare', modes: ['satRush', 'chain'], legacy: true },
  { id: 'mk-phoenix', name: 'PHOENIX', tier: 'rare', mode: null, legacy: true },
  { id: 'mk-metronome', name: 'METRONOME', tier: 'rare', mode: null, legacy: true },
  // ---- EPIC (3) ----
  { id: 'mk-pyro', name: 'PYRO', tier: 'epic', mode: 'fuse', legacy: true },
  { id: 'mk-nova', name: 'NOVA', tier: 'epic', mode: null, legacy: true },
  { id: 'mk-golem', name: 'GOLEM', tier: 'epic', mode: null },
  // ---- LEGENDARY (2) + perk ----
  { id: 'mk-leviathan', name: 'LEVIATHAN', tier: 'legendary', mode: null },
  { id: 'mk-eclipse', name: 'ECLIPSE', tier: 'legendary', mode: null },
  // ---- MYTHIC (2) + perk ----
  { id: 'mk-singularity', name: 'SINGULARITY', tier: 'mythic', mode: null },
  { id: 'mk-kraken', name: 'KRAKEN', tier: 'mythic', mode: null },
  // ---- SECRET (1) + game-changing perks ----
  { id: 'mk-origin', name: 'ORIGIN', tier: 'secret', mode: null },
];

function buildPool() {
  const count = {};
  for (const m of RAW_POOL) count[m.tier] = (count[m.tier] || 0) + 1;
  // every rarer tier is exact: each of its k marks is 1 IN (k × X); commons share the rest evenly
  const rarer = Object.keys(TIER_ODDS).filter((t) => t !== 'common' && count[t]);
  const rest = 1 - rarer.reduce((s, t) => s + 1 / TIER_ODDS[t], 0);
  const xCommon = (count.common || 1) / rest;
  return RAW_POOL.map((m) => ({
    id: m.id,
    name: m.name,
    tier: m.tier,
    x: m.tier === 'common' ? xCommon : count[m.tier] * TIER_ODDS[m.tier],
    mode: m.modes ? null : m.mode,
    modes: m.modes || (m.mode ? [m.mode] : null), // null = every mode
    legacy: !!m.legacy,
    perks: MARK_PERKS[m.id] || [],
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
/** The player's own odds for a mark at a luck value ("YOUR ODDS 1 IN …"). Commons are not luck-scaled. */
export function yourOneInX(id, luckValue = 1) {
  const m = ROLL_BY_ID.get(id);
  if (!m) return null;
  if (m.tier === 'common') return oneInX(id);
  return Math.max(1, Math.round(m.x / Math.max(1, luckValue)));
}

// ---------------------------------------------------------------------------------- permanents
// One PERMANENT mark per KEPT achievement. The four that already exist keep their id, art and owners; six are
// new. `from` is the achievement id. MAIN = LEGENDARY (×3).
export const PERMANENT_MARKS = [
  { id: 'mk-ironhand', name: 'IRONHAND', from: 'vol-10k' },
  { id: 'mk-marathon', name: 'MARATHON', from: 'vol-50k' },
  { id: 'mk-blaze', name: 'BLAZE', from: 'wpm-100' },
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
export const DUPES_PER_GOLD = 10; // 10 dupes → a GOLD
export const GOLDS_PER_RAINBOW = 10; // 10 golds → a RAINBOW
// GOLD doubles the MAIN's BONUS part (COMMON ×1.1 → ×1.2, SECRET ×25 → ×49); RAINBOW ×5 it (×1.5 / ×121).
// The bonus part, not the whole multiplier: a GOLD common at ×2.2 would out-pay a base LEGENDARY's tier ladder.
export const GOLD_MULT = 2;
export const RAINBOW_MULT = 5;
// The INDEX: % of the rollable marks owned pays a small permanent bonus — +0.5% per % collected (+50% at 100%).
export const INDEX_BONUS_PER_PCT = 0.005;
// INDEX milestones: % of the rollable marks owned (base), and of their GOLD and RAINBOW versions → LUCK + a lump.
export const COLLECTION_MILESTONES = [
  { id: 'base-25', track: 'base', pct: 25, luck: 0.05, words: 10 },
  { id: 'base-50', track: 'base', pct: 50, luck: 0.1, words: 15 },
  { id: 'base-75', track: 'base', pct: 75, luck: 0.1, words: 20 },
  { id: 'base-90', track: 'base', pct: 90, luck: 0.15, words: 20 },
  { id: 'base-100', track: 'base', pct: 100, luck: 0.25, words: 20 },
  { id: 'gold-25', track: 'gold', pct: 25, luck: 0.1, words: 15 },
  { id: 'gold-50', track: 'gold', pct: 50, luck: 0.15, words: 20 },
  { id: 'gold-75', track: 'gold', pct: 75, luck: 0.15, words: 20 },
  { id: 'gold-100', track: 'gold', pct: 100, luck: 0.25, words: 20 },
  { id: 'rainbow-25', track: 'rainbow', pct: 25, luck: 0.15, words: 20 },
  { id: 'rainbow-50', track: 'rainbow', pct: 50, luck: 0.2, words: 20 },
  { id: 'rainbow-75', track: 'rainbow', pct: 75, luck: 0.2, words: 20 },
  { id: 'rainbow-100', track: 'rainbow', pct: 100, luck: 0.5, words: 20 },
];
// --------------------------------------------------------------------------------------- state
export function freshState() {
  return { v: ROLL_STATE_VERSION, rolls: 0, sinceEpic: 0, everEpic: false, marks: {}, milestones: [], starter: false };
}
export const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
/** Repair any input into a valid state (unknown ids dropped, counters clamped ≥ 0). Pure. */
export function normalize(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  s.rolls = num(raw.rolls);
  s.sinceEpic = num(raw.sinceEpic);
  s.everEpic = !!raw.everEpic;
  s.starter = !!raw.starter;
  if (raw.marks && typeof raw.marks === 'object') {
    for (const [id, v] of Object.entries(raw.marks)) {
      const n = num(v && typeof v === 'object' ? v.n : v);
      if (ROLL_BY_ID.has(id) && n > 0) s.marks[id] = { n };
    }
  }
  if (Array.isArray(raw.milestones)) s.milestones = [...new Set(raw.milestones.filter((id) => COLLECTION_MILESTONES.some((m) => m.id === id)))];
  return s;
}

/** Copies / dupes / golds / rainbows of one mark. Every count is uncapped. */
export function markLevel(state, id) {
  const n = num(state && state.marks && state.marks[id] && state.marks[id].n);
  const dupes = Math.max(0, n - 1);
  const gold = Math.floor(dupes / DUPES_PER_GOLD);
  const rainbow = Math.floor(gold / GOLDS_PER_RAINBOW);
  const variant = rainbow > 0 ? 'rainbow' : gold > 0 ? 'gold' : n > 0 ? 'base' : null;
  return { copies: n, dupes, gold, rainbow, variant };
}
/** What a finish does to the MAIN's bonus part: base ×1, GOLD ×2, RAINBOW ×5. */
export function variantMult(level) {
  if (level && level.rainbow > 0) return RAINBOW_MULT;
  if (level && level.gold > 0) return GOLD_MULT;
  return 1;
}

/** The INDEX: base / gold / rainbow % over the rollable pool. */
export function collection(state) {
  const total = ROLL_MARKS.length;
  let base = 0;
  let gold = 0;
  let rainbow = 0;
  for (const m of ROLL_MARKS) {
    const lv = markLevel(state, m.id);
    if (lv.copies > 0) base++;
    if (lv.gold > 0) gold++;
    if (lv.rainbow > 0) rainbow++;
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
/**
 * The MAIN multiplier a mark pays when worn: 1 + tier bonus × its finish (GOLD ×2, RAINBOW ×5 of the bonus).
 * `state` = the roll state its finish is read from (omit → the stored one; null → base finish).
 */
export function mainMultOf(id, state) {
  const tier = id ? tierOfAny(id) : null;
  if (!tier) return 1;
  const s = state === undefined ? loadRollState() : state;
  const k = ROLL_BY_ID.has(id) && s ? variantMult(markLevel(s, id)) : 1;
  return 1 + mainBonus(tier) * k;
}
export function mainTag(id, state) {
  const v = mainMultOf(id, state);
  return `MAIN ×${+v.toFixed(2)}`;
}
/** The perk line(s) of a mark ("LETTERS COUNT ×2"), or '' when it has none. */
export function perkLine(id) {
  const m = ROLL_BY_ID.get(id);
  return m && m.perks.length ? m.perks.map((p) => (PERKS[p] ? PERKS[p].line : p)).join(' + ') : '';
}
/**
 * A non-worn owned card's ONE tag (rule U): its PERK when it has one, else what wearing it pays. A perk only
 * runs while its mark is the worn MAIN (markPerks.js), so a non-worn card's perk reads "WEAR: …", never as
 * already on.
 */
export function perkTag(state, id) {
  const p = perkLine(id);
  return p ? `WEAR: ${p}` : mainTag(id, state);
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

/**
 * THE MARK — the ONE number the worn mark pays, on XP per letter (letterXp.js) AND on wins (wins.js
 * perWordFactors → `bonus`): the worn MAIN (tier × GOLD/RAINBOW finish) × the INDEX bonus. Exactly ×1 with
 * nothing worn on a save that has never rolled. `markId` undefined → the worn mark; null → nothing worn.
 * Guarded: a storage failure is ×1.
 */
export function markMult({ markId, state } = {}) {
  try {
    const s = state === undefined ? loadRollState() : state;
    const id = markId === undefined ? wornMarkId() : markId;
    const v = mainMultOf(id, s) * indexMult(s);
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch {
    return 1;
  }
}
