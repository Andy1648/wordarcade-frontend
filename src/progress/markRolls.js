// markRolls.js — MARK ROLLS (Andy oct2, M3 + M6): spend wins on a random mark, Sol's RNG /
// Pet Simulator 99 style. Spec with every number and the reason for it:
// claude/econ-oct2/marks-spec.md. Sim: claude/econ-oct2/marks.md.
//
// THE SHAPE
//   - Every rollable mark has a fixed "1 IN X". Its TIER is read off X (COMMON < 25 ≤ RARE < 100 ≤
//     EPIC < 400 ≤ LEGENDARY), so the tier and the odds can never disagree.
//   - MODE marks (one mode) are the common pool; ALL-MODE marks are rarer.
//   - LUCK multiplies every non-common chance (Sol's shape). Commons take what is left, so luck
//     removes trash rather than breaking the table. One legendary is LUCK-IMMUNE (true odds).
//   - PITY: an EPIC+ is guaranteed by roll 40 (soft from 30), a LEGENDARY by roll 300 (soft from
//     220), and the first EPIC+ by roll 10. Both counters are state, so the UI can show them.
//   - DUPES ARE NEVER DEAD: every copy raises the mark's PERK (+10% of its base); every 10 dupes
//     make a GOLD, every 10 golds a RAINBOW. GOLD and RAINBOW multiply the perk and add LUCK.
//     Nothing is capped: copies, golds, rainbows, luck and the perk all keep counting.
//   - The INDEX (collection %) pays LUCK + a small wins lump at milestones.
//   - PERMANENT marks come only from the hard achievements. They are not rollable, they are the
//     rarest tier and each adds LUCK.
//
// THE ENGINE IS PURE: roll(rng, state, ctx) returns a NEW state and a result; nothing here reads
// the DOM or React. The guarded localStorage store below it is the only side-effecting part, and
// rollBonusMult() is the one hook into the payout (wins.js): it is exactly ×1 for every save that
// has never rolled, so wiring it changes no live payout until the roll UI ships.
import { MARKS, MARK_TIERS, MARKS_OWNED_KEY, MARKS_EQUIPPED_KEY } from './marks.js';
import { keyTierXp, getKeyTier, rebirthMult, getRebirths, priceRateBoost } from './xp.js';

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
// Old marks that are neither rollable nor permanent: their owners keep them (wearable, ranked,
// same marks.js MAIN) but nobody new can get them. All three were ALL-MODE COMMONS, which the
// overhaul does not have (all-mode marks are rare+).
export const RETIRED_MARK_IDS = ['mk-student', 'mk-magpie', 'mk-veteran'];

// ---------------------------------------------------------------------- achievements keep / cut
// Spec §6 has the reason for every row. KEEP = genuinely hard (≥10 h of median play, a skill bar
// the median never reaches, or 30 real days); it awards the PERMANENT mark above.
export const ACHIEVEMENT_PLAN = {
  'vol-1': 'cut', 'vol-100': 'cut', 'vol-1k': 'cut', 'vol-10k': 'keep', 'vol-50k': 'keep',
  'wpm-40': 'cut', 'wpm-70': 'cut', 'wpm-100': 'keep',
  'obs-1': 'cut', 'obs-50': 'cut', 'dist-500': 'cut', 'dist-2500': 'keep',
  'lv-15': 'cut', 'reb-1': 'cut', 'lv-50': 'cut', 'reb-5': 'cut', 'lv-300': 'keep',
  'streak-3': 'cut', 'streak-7': 'cut', 'streak-30': 'keep',
  'm-wb-5': 'cut', 'm-blitz-5': 'cut', 'm-sat-5': 'cut', 'm-chain-5': 'cut', 'm-fuse-5': 'cut', 'm-all-3': 'cut',
  'kp-5': 'cut', 'forge-26': 'cut', 'frenzy-1': 'cut', 'kp-8': 'cut',
  'sec-millionaire': 'cut', 'sec-dict': 'keep', 'sec-eternal': 'keep', 'sec-truemaster': 'keep', 'sec-completionist': 'keep',
};
export const KEPT_ACHIEVEMENTS = Object.keys(ACHIEVEMENT_PLAN).filter((k) => ACHIEVEMENT_PLAN[k] === 'keep');

// ------------------------------------------------------------------------------------- numbers
export const PITY = {
  epic: { hard: 40, softFrom: 30, softStep: 0.05 }, // epic+ guaranteed on roll 40 of a drought
  legendary: { hard: 300, softFrom: 220, softStep: 0.015 },
  firstEpicBy: 10, // the first EPIC+ ever lands by roll 10
};
export const DUPES_PER_GOLD = 10; // 10 dupes → a GOLD
export const GOLDS_PER_RAINBOW = 10; // 10 golds → a RAINBOW
export const PERK_PER_COPY = 0.1; // every copy past the first: +10% of the base perk
export const GOLD_MULT = 1.25; // GOLD perk ×1.25
export const RAINBOW_MULT = 1.6; // RAINBOW perk ×1.6
export const RAINBOW_STEP = 0.1; // every rainbow past the first: +10% more (no cap)
export const LUCK_SOURCES = {
  permanent: 0.1, // each PERMANENT (hard-achievement) mark owned
  goldMark: 0.02, // each mark that has gone GOLD
  rainbowMark: 0.05, // each mark that has gone RAINBOW
  rainbowStar: 0.01, // each further RAINBOW of a mark (every 1,000 dupes) — keeps luck uncapped
  boost: 1.0, // while a BOOST runs
};
export const BONUS_ROLL_EVERY = 10; // every 10th roll ×2 luck ("×2 LUCK READY")
export const BONUS_ROLL_MULT = 2;
export const ROLL_UNLOCK_LEVEL = 10; // with MARKS (marks.js MARKS_UNLOCK_LEVEL), or any rebirth
// PRICE: words at the player's FULL rate — the same reference word the LETTER FORGE is priced in
// (key tier × rebirth × priceRateBoost: forge, STAR POWER, the worn MAIN and the roll PERKS), so
// every roll is the same few seconds-to-minutes of play at LV1 and at LV1000. It also scales with
// LEVEL: ROLL_BASE_WORDS × (1 + level / ROLL_LEVEL_SPAN).
// DECIDED (Andy oct3): 60 words (was 100) — the same level scaling and the same reference word.
export const ROLL_BASE_WORDS = 60;
export const ROLL_LEVEL_SPAN = 1000;
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
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
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
function milestonesReached(state) {
  const c = collection(state);
  const at = { base: c.pct, gold: c.goldPct, rainbow: c.rainbowPct };
  return COLLECTION_MILESTONES.filter((m) => at[m.track] >= m.pct - 1e-9).map((m) => m.id);
}

/**
 * LUCK. luck = (1 + Σ additive) × (×2 on every 10th roll). ctx: { permanentOwned (count),
 * boost (bool) }. Additive: each PERMANENT mark +0.10, each GOLD mark +0.02, each RAINBOW mark
 * +0.05 (+0.01 per further rainbow), each paid INDEX milestone its luck, a live BOOST +1.0.
 * Uncapped (every source is a count).
 */
export function luck(state, ctx = {}) {
  let add = 0;
  add += LUCK_SOURCES.permanent * num(ctx.permanentOwned);
  for (const m of ROLL_MARKS) {
    const lv = markLevel(state, m.id);
    if (lv.gold > 0) add += LUCK_SOURCES.goldMark;
    if (lv.rainbow > 0) add += LUCK_SOURCES.rainbowMark + LUCK_SOURCES.rainbowStar * (lv.rainbow - 1);
  }
  for (const id of state.milestones || []) {
    const ms = COLLECTION_MILESTONES.find((x) => x.id === id);
    if (ms) add += ms.luck;
  }
  if (ctx.boost) add += LUCK_SOURCES.boost;
  return 1 + add;
}
export function isBonusRoll(state) {
  return (num(state.rolls) + 1) % BONUS_ROLL_EVERY === 0;
}
/** The shown pity counters: rolls left until the guarantee (1 = the next roll is guaranteed). */
export function pityLeft(state) {
  const epicHard = !state.everEpic ? Math.min(PITY.epic.hard, PITY.firstEpicBy - num(state.rolls)) : PITY.epic.hard - num(state.sinceEpic);
  return { epic: Math.max(1, epicHard), legendary: Math.max(1, PITY.legendary.hard - num(state.sinceLegendary)) };
}

/**
 * The exact chance of every mark on the NEXT roll, given state + ctx. Returns { probs: Map id→p,
 * forced: null|'epic'|'legendary', luck, bonus }. The probabilities sum to 1.
 */
export function rollTable(state, ctx = {}) {
  const bonus = isBonusRoll(state);
  const L = luck(state, ctx) * (bonus ? BONUS_ROLL_MULT : 1);
  const w = new Map();
  for (const m of ROLL_MARKS) if (m.tier !== 'common') w.set(m.id, (m.immune ? 1 : L) / m.x);
  const group = (pred) => ROLL_MARKS.filter((m) => m.tier !== 'common' && pred(m));
  const epicPlus = group((m) => tierRank(m.tier) >= tierRank('epic'));
  const legs = group((m) => m.tier === 'legendary');
  const sumOf = (arr) => arr.reduce((s, m) => s + w.get(m.id), 0);
  // soft pity: add mass to a group, spread by its own weights
  const lift = (arr, extra) => {
    if (extra <= 0) return;
    const s = sumOf(arr);
    for (const m of arr) w.set(m.id, w.get(m.id) + (extra * w.get(m.id)) / s);
  };
  const nextLeg = num(state.sinceLegendary) + 1;
  const nextEpic = num(state.sinceEpic) + 1;
  lift(legs, PITY.legendary.softStep * Math.max(0, nextLeg - PITY.legendary.softFrom + 1));
  lift(epicPlus, PITY.epic.softStep * Math.max(0, nextEpic - PITY.epic.softFrom + 1));
  let forced = null;
  if (nextLeg >= PITY.legendary.hard) forced = 'legendary';
  else if (nextEpic >= PITY.epic.hard || (!state.everEpic && num(state.rolls) + 1 >= PITY.firstEpicBy)) forced = 'epic';
  const probs = new Map();
  if (forced) {
    const arr = forced === 'legendary' ? legs : epicPlus;
    const s = sumOf(arr);
    for (const m of ROLL_MARKS) probs.set(m.id, arr.includes(m) ? w.get(m.id) / s : 0);
    return { probs, forced, luck: L, bonus };
  }
  let S = 0;
  for (const v of w.values()) S += v;
  if (S >= 1) {
    // luck past the table: commons are gone, the rest renormalised (Sol's "luck removes trash")
    for (const m of ROLL_MARKS) probs.set(m.id, m.tier === 'common' ? 0 : w.get(m.id) / S);
  } else {
    const commons = ROLL_MARKS.filter((m) => m.tier === 'common');
    const cw = commons.reduce((s, m) => s + 1 / m.x, 0);
    for (const m of ROLL_MARKS) probs.set(m.id, m.tier === 'common' ? ((1 - S) * (1 / m.x)) / cw : w.get(m.id));
  }
  return { probs, forced: null, luck: L, bonus };
}

/**
 * ONE ROLL. Pure: returns { state (new), result }. `rng` is () → [0,1). ctx: { permanentOwned,
 * boost }. result: { markId, tier, oneInX, dupe, newMark, copies, goldUp, rainbowUp, gold, rainbow,
 * pityHit ('epic'|'legendary'|null), bonusRoll, luck, milestones (newly reached ids) }.
 */
export function roll(rng, state, ctx = {}) {
  const s0 = normalize(state);
  const { probs, forced, luck: L, bonus } = rollTable(s0, ctx);
  let u = rng();
  if (!(u >= 0 && u < 1)) u = 0;
  let pick = null;
  let last = null;
  for (const m of ROLL_MARKS) {
    const p = probs.get(m.id);
    if (!(p > 0)) continue;
    last = m;
    if (u < p) {
      pick = m;
      break;
    }
    u -= p;
  }
  pick = pick || last; // float dust at the very end of the table
  const before = markLevel(s0, pick.id);
  const s = { ...s0, marks: { ...s0.marks }, milestones: [...s0.milestones] };
  s.marks[pick.id] = { n: before.copies + 1 };
  const after = markLevel(s, pick.id);
  s.rolls = s0.rolls + 1;
  const tr = tierRank(pick.tier);
  s.sinceEpic = tr >= tierRank('epic') ? 0 : s0.sinceEpic + 1;
  s.sinceLegendary = pick.tier === 'legendary' ? 0 : s0.sinceLegendary + 1;
  if (tr >= tierRank('epic')) s.everEpic = true;
  const had = new Set(s0.milestones);
  const reached = milestonesReached(s).filter((id) => !had.has(id));
  s.milestones.push(...reached);
  return {
    state: s,
    result: {
      markId: pick.id,
      tier: pick.tier,
      oneInX: oneInX(pick.id),
      dupe: before.copies > 0,
      newMark: before.copies === 0,
      copies: after.copies,
      goldUp: after.gold > before.gold,
      rainbowUp: after.rainbow > before.rainbow,
      gold: after.gold,
      rainbow: after.rainbow,
      pityHit: forced,
      bonusRoll: bonus,
      luck: L,
      milestones: reached,
    },
  };
}

// ----------------------------------------------------------------------------------- price
export function rollPriceWords(level = 1) {
  const lv = Number.isFinite(level) && level >= 1 ? Math.floor(level) : 1;
  return ROLL_BASE_WORDS * (1 + lv / ROLL_LEVEL_SPAN);
}
/** Wins price of one roll: words(level) × the reference word's wins (`rate`). Never below 1. */
export function rollPrice({ level = 1, rate = 0 } = {}) {
  const r = Number.isFinite(rate) && rate > 0 ? rate : 0;
  return Math.max(1, Math.round(rollPriceWords(level) * r));
}
/** The reference word's wins at the player's full rate (forge.js forgeCost uses the same base). */
export function refWordWins() {
  return ((keyTierXp(getKeyTier()) * 5) / 10) * rebirthMult(getRebirths()) * priceRateBoost();
}
export function rollPriceNow(level = 1) {
  return rollPrice({ level, rate: refWordWins() });
}
/** An INDEX milestone's wins lump, priced the same way. */
export function milestoneWins(id, rate = 0) {
  const m = COLLECTION_MILESTONES.find((x) => x.id === id);
  return m && rate > 0 ? Math.round(m.words * rate) : 0;
}
// AUTO-EQUIP (Andy M6, DECIDED oct3). A roll auto-equips ONLY when its MAIN is HIGHER than the worn
// MAIN (not merely rarer) AND at most ×1.5 of it. A bigger jump is never automatic: the UI asks
// "EQUIP? ×N → ×M". That caps any silent income step from one roll at ×1.5 (marks.md §2, open
// question 5: a casual ×2 → ×4 auto-equip was worth up to 19 levels). Nothing worn counts as ×1, so
// the first mark (×2) is always ASKED. A PERMANENT (×4, the top) is never displaced.
export const AUTO_EQUIP_MAX_STEP = 1.5;
/** The MAIN a worn id pays at rank I: rolled/permanent by tier, legacy/retired by its marks.js tier.
 *  No id → ×1. Callers that know a legacy mark's real rank pass `wornMain` to equipDecision. */
export function wornMainOf(wornId) {
  if (!wornId) return 1;
  const r = ROLL_BY_ID.get(wornId) || PERM_BY_ID.get(wornId) || legacyTierOf(wornId);
  return r ? 1 + mainBonus(r.tier) : 1;
}
/**
 * 'auto' (equip silently), 'ask' (show EQUIP? ×N → ×M) or 'none' (the new MAIN is not higher).
 * `wornMain` overrides the worn id's rank-I MAIN (a legacy mark at rank V pays more than rank I).
 */
export function equipDecision(newId, wornId, wornMain) {
  const n = ROLL_BY_ID.get(newId);
  if (!n || wornId === newId) return 'none';
  const cur = Number.isFinite(wornMain) && wornMain > 0 ? wornMain : wornMainOf(wornId);
  const next = mainMultOf(newId);
  if (!(next > cur + 1e-9)) return 'none';
  return next <= cur * AUTO_EQUIP_MAX_STEP + 1e-9 ? 'auto' : 'ask';
}
export function shouldAutoEquip(newId, wornId, wornMain) {
  return equipDecision(newId, wornId, wornMain) === 'auto';
}
function legacyTierOf(id) {
  const m = MARKS.find((x) => x.id === id);
  return m ? { tier: m.tier } : null;
}

// ---------------------------------------------------------------------------------- migration
/**
 * An existing save → roll state. Every legacy mark it OWNS that is now rollable counts as one copy
 * (it shows as collected in the INDEX). Nothing is ever removed: copies only go up (max), the
 * marks.js owned set, ranks (taw.markWords) and the worn MAIN (taw.mark) are not touched. Pure +
 * idempotent: migrate(migrate(x)) deep-equals migrate(x).
 */
export function migrate(raw, { ownedIds = [] } = {}) {
  const s = normalize(raw);
  s.marks = { ...s.marks };
  for (const id of ownedIds) {
    if (!ROLL_BY_ID.has(id)) continue;
    const n = s.marks[id] ? s.marks[id].n : 0;
    s.marks[id] = { n: Math.max(n, 1) };
  }
  const had = new Set(s.milestones);
  s.milestones = [...s.milestones, ...milestonesReached(s).filter((id) => !had.has(id))];
  return s;
}

// ------------------------------------------------------------------------------ guarded store
function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
/** marks.js owned ids, or (a save that never opened MARKS) the ones its achievements earned. */
function legacyOwnedIds() {
  const owned = readJson(MARKS_OWNED_KEY);
  if (Array.isArray(owned)) return owned.filter((x) => typeof x === 'string');
  const earned = readJson('taw.achievements');
  const set = new Set(Array.isArray(earned) ? earned : []);
  return MARKS.filter((m) => set.has(m.from)).map((m) => m.id);
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
/** First touch of the roll system on this save: migrate legacy owned marks in. Idempotent. */
export function ensureRollState() {
  const cur = loadRollState();
  const s = migrate(cur || freshState(), { ownedIds: legacyOwnedIds() });
  saveRollState(s);
  return s;
}
/** PERMANENT marks this save owns (via marks.js owned set + the new ids it gets on its claims). */
export function permanentOwnedCount() {
  const owned = new Set(legacyOwnedIds());
  const extra = readJson('taw.permanentMarks');
  if (Array.isArray(extra)) for (const id of extra) owned.add(id);
  return PERMANENT_MARKS.filter((m) => owned.has(m.id)).length;
}
/**
 * Roll once and persist. Does NOT spend wins — the caller charges rollPrice() first (the shop owns
 * the balance). A legacy mark rolled for the first time also joins marks.js's owned set so it is
 * wearable with its old MAIN + rank. Returns the result (plus the new state).
 */
export function rollAndSave(rng, ctx = {}) {
  const s = ensureRollState();
  const out = roll(rng, s, { permanentOwned: permanentOwnedCount(), ...ctx });
  saveRollState(out.state);
  const m = ROLL_BY_ID.get(out.result.markId);
  if (m && m.legacy && out.result.newMark) {
    const ids = legacyOwnedIds();
    if (!ids.includes(m.id)) {
      try {
        localStorage.setItem(MARKS_OWNED_KEY, JSON.stringify([...ids, m.id]));
      } catch {
        /* blocked */
      }
    }
  }
  return { ...out.result, state: out.state };
}
/** Wear a rolled mark as MAIN (it must be owned). Legacy ids go through marks.js as before. */
export function equipRolled(id) {
  const s = loadRollState();
  if (!s || !s.marks[id]) return false;
  try {
    localStorage.setItem(MARKS_EQUIPPED_KEY, id);
  } catch {
    return false;
  }
  return true;
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
/** The read-only view the INDEX draws: the stored state with the legacy-owned marks migrated in
 *  (pure — nothing is written until the first roll, so opening MARKS never changes a payout). */
export function viewState(ownedIds = legacyOwnedIds()) {
  return migrate(loadRollState() || freshState(), { ownedIds });
}
/** The next unpaid INDEX milestone on the base track (then gold, then rainbow), or null. */
export function nextMilestone(state) {
  const had = new Set((state && state.milestones) || []);
  return COLLECTION_MILESTONES.find((m) => !had.has(m.id)) || null;
}
/** The free starter roll is still waiting (the MARKS unlock gives one). */
export function starterRollReady(state) {
  return !(state && state.starter);
}
/** PERMANENT ids this save owns (legacy owned set + taw.permanentMarks). */
export function permanentOwnedIds() {
  const owned = new Set(legacyOwnedIds());
  const extra = readJson('taw.permanentMarks');
  if (Array.isArray(extra)) for (const id of extra) owned.add(id);
  return PERMANENT_MARKS.filter((m) => owned.has(m.id)).map((m) => m.id);
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
