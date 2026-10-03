// markRollsCore.js — the part of MARK ROLLS the PAYOUT and the MENU need on boot: the pool, the stored
// state, the PERK / MAIN math, rollBonusMult() (wins.js) and the worn-mark helpers (the menu chip). Split out
// of markRolls.js so the rest of the roll system (odds, pity, luck, price, migration, rolling) loads only with
// the MARKS panel (payload ratchet, PR #156). markRolls.js re-exports all of this, so its importers are
// unchanged. Pure + a guarded read/write of one storage key.
import { MARKS, MARK_TIERS, MARKS_EQUIPPED_KEY } from './marks.js';

export const ROLL_STATE_KEY = 'taw.markRolls';
export const ROLL_STATE_VERSION = 1;

// ---------------------------------------------------------------------------------------- tiers
export const ROLL_TIER_ORDER = ['common', 'rare', 'epic', 'legendary', 'permanent'];
/** Lower bound of X for each tier. A mark's tier is DERIVED from its X with this table. */
export const TIER_BANDS = { common: 1, rare: 25, epic: 100, legendary: 400 };
export function tierForX(x) {
  if (x >= TIER_BANDS.legendary) return 'legendary';
  if (x >= TIER_BANDS.epic) return 'epic';
  if (x >= TIER_BANDS.rare) return 'rare';
  return 'common';
}
export function tierRank(tier) {
  const i = ROLL_TIER_ORDER.indexOf(tier);
  return i < 0 ? 0 : i;
}
// MAIN bonus (the part above ×1) when worn. COMMON..LEGENDARY are marks.js MARK_TIERS unchanged;
// PERMANENT matches LEGENDARY (×4) — it is the rarest by how you get it, not a bigger number
// (DECIDED, Andy oct3: permanent MAIN ×4 — the ×5 question is closed).
// Read at call time, not import time: marks.js → claims.js → wins.js → this module is a cycle.
export function mainBonus(tier) {
  const t = tier === 'permanent' ? 'legendary' : tier;
  return (MARK_TIERS[t] || MARK_TIERS.common).bonus;
}

// ---------------------------------------------------------------------------------------- pool
// mode = payout key (wins.js PAYOUT_MODES) or null for ALL-MODE. `perk` = the PERK at 1 copy, a
// fraction of wins (+0.02 = +2%) in that mode (or every mode). `legacy` = the id already exists in
// marks.js (its owners keep it, its rank and its marks.js MAIN). `x` for COMMONS is derived below
// so the table sums to exactly 1.
const RAW_POOL = [
  // ---- COMMON: two per mode (12) — the mode-specific pool ----
  { id: 'mk-bomber', name: 'BOMBER', mode: 'wordBomb', legacy: true },
  { id: 'mk-sparky', name: 'SPARKY', mode: 'wordBomb' },
  { id: 'mk-sprinter', name: 'SPRINTER', mode: 'blitz', legacy: true },
  { id: 'mk-dasher', name: 'DASHER', mode: 'blitz' },
  { id: 'mk-crammer', name: 'CRAMMER', mode: 'satRush' },
  { id: 'mk-inkwell', name: 'INKWELL', mode: 'satRush' },
  { id: 'mk-linker', name: 'LINKER', mode: 'chain', legacy: true },
  { id: 'mk-shackle', name: 'SHACKLE', mode: 'chain' },
  { id: 'mk-wick', name: 'WICK', mode: 'fuse' },
  { id: 'mk-matchstick', name: 'MATCHSTICK', mode: 'fuse' },
  { id: 'mk-pacer', name: 'PACER', mode: 'wordRace' },
  { id: 'mk-nitro', name: 'NITRO', mode: 'wordRace' },
  // ---- RARE: one per mode (6) at 1 IN 40, then the ALL-MODE rares (3) at 1 IN 75 ----
  { id: 'mk-detonator', name: 'DETONATOR', mode: 'wordBomb', x: 40, perk: 0.04 },
  { id: 'mk-cyclone', name: 'CYCLONE', mode: 'blitz', x: 40, perk: 0.04 },
  { id: 'mk-scholar', name: 'SAVANT', mode: 'satRush', x: 40, perk: 0.04, legacy: true },
  { id: 'mk-ouroboros', name: 'OUROBOROS', mode: 'chain', x: 40, perk: 0.04 },
  { id: 'mk-tinder', name: 'TINDER', mode: 'fuse', x: 40, perk: 0.04 },
  { id: 'mk-slipstream', name: 'SLIPSTREAM', mode: 'wordRace', x: 40, perk: 0.04 },
  { id: 'mk-smith', name: 'SMITH', modes: ['satRush', 'chain'], x: 60, perk: 0.03, legacy: true },
  { id: 'mk-phoenix', name: 'PHOENIX', mode: null, x: 75, perk: 0.02, legacy: true },
  { id: 'mk-metronome', name: 'METRONOME', mode: null, x: 75, perk: 0.02, legacy: true },
  // ---- EPIC: ALL-MODE (+ PYRO, the one legacy FUSE epic) ----
  { id: 'mk-pyro', name: 'PYRO', mode: 'fuse', x: 100, perk: 0.08, legacy: true },
  { id: 'mk-nova', name: 'NOVA', mode: null, x: 120, perk: 0.04, legacy: true },
  { id: 'mk-kraken', name: 'KRAKEN', mode: null, x: 150, perk: 0.04 },
  { id: 'mk-golem', name: 'GOLEM', mode: null, x: 150, perk: 0.04 },
  { id: 'mk-eclipse', name: 'ECLIPSE', mode: null, x: 200, perk: 0.04 },
  // ---- LEGENDARY: ALL-MODE only. ORIGIN is luck-immune (true odds, the forever flex). ----
  { id: 'mk-leviathan', name: 'LEVIATHAN', mode: null, x: 400, perk: 0.06 },
  { id: 'mk-singularity', name: 'SINGULARITY', mode: null, x: 1000, perk: 0.06 },
  { id: 'mk-origin', name: 'ORIGIN', mode: null, x: 10000, perk: 0.06, immune: true },
];
export const COMMON_PERK = 0.02;

function buildPool() {
  const fixed = RAW_POOL.filter((m) => m.x);
  const commons = RAW_POOL.filter((m) => !m.x);
  const rest = 1 - fixed.reduce((s, m) => s + 1 / m.x, 0);
  const xCommon = commons.length / rest; // every common shares the remainder equally
  return RAW_POOL.map((m) => {
    const x = m.x || xCommon;
    return {
      id: m.id,
      name: m.name,
      x,
      tier: tierForX(x),
      mode: m.modes ? null : m.mode,
      modes: m.modes || (m.mode ? [m.mode] : null), // null = every mode
      perk: m.perk || COMMON_PERK,
      legacy: !!m.legacy,
      immune: !!m.immune,
    };
  });
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
  if (m.tier === 'common' || m.immune) return oneInX(id);
  return Math.max(1, Math.round(m.x / Math.max(1, luckValue)));
}

// ---------------------------------------------------------------------------------- permanents
// One PERMANENT mark per KEPT achievement (spec §5). The four that already exist keep their id,
// art, rank and owners; six are new. `from` is the achievement id.
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
export const PERK_PER_COPY = 0.1; // every copy past the first: +10% of the base perk
export const GOLD_MULT = 1.25; // GOLD perk ×1.25
export const RAINBOW_MULT = 1.6; // RAINBOW perk ×1.6
export const RAINBOW_STEP = 0.1; // every rainbow past the first: +10% more (no cap)
// The INDEX: % of the rollable marks owned (base), and of their GOLD and RAINBOW versions.
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
  return { v: ROLL_STATE_VERSION, rolls: 0, sinceEpic: 0, sinceLegendary: 0, everEpic: false, marks: {}, milestones: [], starter: false };
}
export const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
/** Repair any input into a valid state (unknown ids dropped, counters clamped ≥ 0). Pure. */
export function normalize(raw) {
  const s = freshState();
  if (!raw || typeof raw !== 'object') return s;
  s.rolls = num(raw.rolls);
  s.sinceEpic = num(raw.sinceEpic);
  s.sinceLegendary = num(raw.sinceLegendary);
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
export function variantMult(level) {
  if (level.rainbow > 0) return RAINBOW_MULT * (1 + RAINBOW_STEP * (level.rainbow - 1));
  if (level.gold > 0) return GOLD_MULT;
  return 1;
}
/** A mark's PERK (fraction of wins) at its copies + variant. 0 when not owned. */
export function perkOf(state, id) {
  const m = ROLL_BY_ID.get(id);
  const lv = markLevel(state, id);
  if (!m || lv.copies < 1) return 0;
  return m.perk * (1 + PERK_PER_COPY * lv.dupes) * variantMult(lv);
}
/** The PERK tag ("PERK +4%"), whole percent, at least 1 decimal under 10%. */
export function perkTag(state, id) {
  const p = perkOf(state, id) || (ROLL_BY_ID.get(id) || {}).perk || 0;
  const pc = p * 100;
  return `PERK +${pc < 10 ? +pc.toFixed(1) : Math.round(pc)}%`;
}
/** The MAIN multiplier a mark pays when worn (tier only — copies grow the PERK, not the MAIN). */
export function mainMultOf(id) {
  const m = ROLL_BY_ID.get(id) || PERM_BY_ID.get(id);
  return m ? 1 + mainBonus(m.tier) : 1;
}
export function mainTag(id) {
  const v = mainMultOf(id);
  return `MAIN ×${+v.toFixed(2)}`;
}
/** The summed PERK for one payout mode: 1 + Σ perks of owned marks that cover it. Linear, uncapped. */
export function perkMult(state, mode) {
  let sum = 0;
  for (const m of ROLL_MARKS) {
    if (!state.marks[m.id]) continue;
    if (m.modes && !m.modes.includes(mode)) continue;
    sum += perkOf(state, m.id);
  }
  return 1 + sum;
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
 * THE PAYOUT HOOK (wins.js perWordFactors → bonus). ×(summed PERK for this mode) × (the rolled
 * MAIN, when the worn mark is a NEW rolled id — legacy ids keep paying their MAIN through marks.js).
 * Exactly 1 on a save that has never rolled.
 */
export function rollBonusMult({ mode } = {}) {
  const s = loadRollState();
  if (!s) return 1;
  let mult = perkMult(s, mode);
  let worn = null;
  try {
    worn = localStorage.getItem(MARKS_EQUIPPED_KEY);
  } catch {
    worn = null;
  }
  const m = worn && ROLL_BY_ID.get(worn);
  if (m && !m.legacy && s.marks[worn]) mult *= mainMultOf(worn);
  return mult;
}
