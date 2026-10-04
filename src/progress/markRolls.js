// markRolls.js — MARK ROLLS: spend wins on a random mark, Sol's RNG / Blox Fruits gacha style.
// MARKS via ROLLS (Andy, PROGRESSION FINAL — turned on with the Rebirth Rush economy). Feel notes:
// claude/econ-oct2/rolls-rr-notes.md.
//
// THE SHAPE
//   - Six tiers, Andy's odds: COMMON 1 IN 2, RARE 1 IN 10, EPIC 1 IN 100, LEGENDARY 1 IN 1,000,
//     MYTHIC 1 IN 10,000, SECRET 1 IN 100,000 (the tier's chance; its marks split it evenly; COMMON is
//     the remainder). The pool, the MAIN math and markMult() live in markRollsCore.js.
//   - LUCK multiplies every non-common chance (Sol's shape). Commons take what is left, so luck
//     removes trash rather than breaking the table.
//   - PITY: an EPIC-or-better is guaranteed at least every 50 rolls (soft from 40), and the first by roll 10.
//     The counter is state, so the UI can show it.
//   - DUPES: every 10 dupes make a GOLD (the MAIN's bonus ×2), every 10 golds a RAINBOW (×5).
//   - The INDEX (% collected) pays a small permanent bonus (+0.5% per %) + LUCK and a wins lump at milestones.
//   - PERKS (markPerks.js): LEGENDARY+ marks carry a perk that runs while that mark is the worn MAIN.
//   - PERMANENT marks come only from the hard achievements. They are not rollable and each adds LUCK.
//
// THE ENGINE IS PURE: roll(rng, state, ctx) returns a NEW state and a result; nothing here reads
// the DOM or React. The guarded localStorage store below it is the only side-effecting part.
//
// SPLIT (PR #156 payload): the pool, the state, the MAIN math and the payout hook live in markRollsCore.js (on
// boot, for wins.js / letterXp.js and the menu chip). Everything else here loads with the MARKS panel. This
// module re-exports the core, so `import … from './markRolls.js'` still sees everything.
import { MARKS, MARKS_OWNED_KEY, MARKS_EQUIPPED_KEY } from './marks.js';
import { gameKey, WORD_LEN_REF } from './wins.js';
import { xpPerWord } from './xp.js';
import {
  ROLL_MARKS, rollMarkById, permanentMarkById, PERMANENT_MARKS, tierRank, mainBonus, oneInX, COLLECTION_MILESTONES,
  freshState, normalize, markLevel, mainMultOf, loadRollState, saveRollState, num, collection,
} from './markRollsCore.js';

export * from './markRollsCore.js';
const ROLL_BY_ID = { get: rollMarkById, has: (id) => !!rollMarkById(id) };
const PERM_BY_ID = { get: permanentMarkById };

// Old marks that are neither rollable nor permanent: their owners keep them (wearable, ranked,
// their marks.js tier's MAIN) but nobody new can get them. All three were ALL-MODE COMMONS.
export const RETIRED_MARK_IDS = ['mk-student', 'mk-magpie', 'mk-veteran'];

// ---------------------------------------------------------------------- achievements keep / cut
// KEEP = genuinely hard (≥10 h of median play, a skill bar the median never reaches, or 30 real days);
// it awards the PERMANENT mark.
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
  epic: { hard: 50, softFrom: 40, softStep: 0.05 }, // EPIC-or-better guaranteed on roll 50 of a drought (Andy)
  firstEpicBy: 10, // the first EPIC+ ever lands by roll 10
};
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
// PRICE (Andy): "cost 60 words of wins at your rate" — 60 × the live per-word rate of the reference word
// (wins.js perWordRateNow, Word Bomb), WITHOUT the timed multipliers (BOOST / OVERDRIVE / FRENZY): a roll
// never costs ten times more because OVERDRIVE happens to be running — and WITHOUT the MARK (see refWordWins).
export const ROLL_BASE_WORDS = 60;

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
/** The shown pity counter: rolls left until the EPIC+ guarantee (1 = the next roll is guaranteed). */
export function pityLeft(state) {
  const epicHard = !state.everEpic ? Math.min(PITY.epic.hard, PITY.firstEpicBy - num(state.rolls)) : PITY.epic.hard - num(state.sinceEpic);
  return { epic: Math.max(1, epicHard) };
}

/**
 * The exact chance of every mark on the NEXT roll, given state + ctx. Returns { probs: Map id→p,
 * forced: null|'epic', luck, bonus }. The probabilities sum to 1.
 */
export function rollTable(state, ctx = {}) {
  const bonus = isBonusRoll(state);
  const L = luck(state, ctx) * (bonus ? BONUS_ROLL_MULT : 1);
  const w = new Map();
  for (const m of ROLL_MARKS) if (m.tier !== 'common') w.set(m.id, L / m.x);
  const epicPlus = ROLL_MARKS.filter((m) => tierRank(m.tier) >= tierRank('epic'));
  const sumOf = (arr) => arr.reduce((s, m) => s + w.get(m.id), 0);
  // soft pity: add mass to the EPIC+ group, spread by its own weights
  const nextEpic = num(state.sinceEpic) + 1;
  const extra = PITY.epic.softStep * Math.max(0, nextEpic - PITY.epic.softFrom + 1);
  if (extra > 0) {
    const s = sumOf(epicPlus);
    for (const m of epicPlus) w.set(m.id, w.get(m.id) + (extra * w.get(m.id)) / s);
  }
  let forced = null;
  if (nextEpic >= PITY.epic.hard || (!state.everEpic && num(state.rolls) + 1 >= PITY.firstEpicBy)) forced = 'epic';
  const probs = new Map();
  if (forced) {
    const s = sumOf(epicPlus);
    for (const m of ROLL_MARKS) probs.set(m.id, epicPlus.includes(m) ? w.get(m.id) / s : 0);
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
 * pityHit ('epic'|null), bonusRoll, luck, milestones (newly reached ids) }.
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
/** Words one roll costs (flat 60 — Andy). `level` is accepted for old callers and ignored. */
// eslint-disable-next-line no-unused-vars
export function rollPriceWords(level = 1) {
  return ROLL_BASE_WORDS;
}
/** Wins price of one roll: 60 × the reference word's wins (`rate`). Never below 1. */
export function rollPrice({ level = 1, rate = 0 } = {}) {
  const r = Number.isFinite(rate) && rate > 0 ? rate : 0;
  return Math.max(1, Math.round(rollPriceWords(level) * r));
}
/**
 * The reference word's wins at the player's live rate (Word Bomb, 5 letters) WITHOUT the timed boosts AND WITHOUT
 * the MARK (perWordFactors `bonus`: worn MAIN × INDEX). The mark is out of the price on purpose: with it in,
 * taking a MYTHIC off before rolling made a roll up to ~121× cheaper. What's worn never changes the price.
 * It is the same xpPerWord the live rate runs on, with the bonus stack at ×1 — exact, not a rounded rate ÷ mark.
 */
export function refWordWins() {
  try {
    const v = xpPerWord({ mode: gameKey('wordBomb'), wordLength: WORD_LEN_REF, bonusMult: 1 }) / 10;
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}
export function rollPriceNow(level = 1) {
  return rollPrice({ level, rate: refWordWins() });
}
/** An INDEX milestone's wins lump, priced the same way. */
export function milestoneWins(id, rate = 0) {
  const m = COLLECTION_MILESTONES.find((x) => x.id === id);
  return m && rate > 0 ? Math.round(m.words * rate) : 0;
}
// AUTO-EQUIP: a roll auto-equips WHENEVER its MAIN is HIGHER than the worn MAIN — always when nothing is worn
// (×1). A sidegrade or downgrade never equips and never asks (the player can SET AS MAIN by hand). No prompt,
// so nothing ever stalls a hold.
/** The MAIN a worn id pays (rolled / permanent / legacy / retired, with its finish). No id → ×1. */
export function wornMainOf(wornId) {
  if (!wornId) return 1;
  const r = ROLL_BY_ID.get(wornId) || PERM_BY_ID.get(wornId) || legacyTierOf(wornId);
  return r ? mainMultOf(wornId) : 1;
}
/**
 * 'auto' (the new MAIN is higher: equip it) or 'none' (equal / lower: leave the worn one).
 * `wornMain` overrides the worn id's MAIN.
 */
export function equipDecision(newId, wornId, wornMain) {
  const n = ROLL_BY_ID.get(newId);
  if (!n || wornId === newId) return 'none';
  const cur = Number.isFinite(wornMain) && wornMain > 0 ? wornMain : wornMainOf(wornId);
  return mainMultOf(newId) > cur + 1e-9 ? 'auto' : 'none';
}
export function shouldAutoEquip(newId, wornId, wornMain) {
  return equipDecision(newId, wornId, wornMain) === 'auto';
}
function legacyTierOf(id) {
  const m = MARKS.find((x) => x.id === id);
  return m ? { tier: m.tier } : null;
}
/** Tier base MAIN (no finish) — for the "UP TO ×N" copy. */
export function tierMain(tier) {
  return 1 + mainBonus(tier);
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
/** First touch of the roll system on this save: migrate legacy owned marks in. Idempotent. */
export function ensureRollState() {
  const cur = loadRollState();
  const s = migrate(cur || freshState(), { ownedIds: legacyOwnedIds() });
  saveRollState(s);
  return s;
}
/** PERMANENT marks this save owns (via marks.js owned set + the new ids it gets on its claims). */
export function permanentOwnedCount() {
  return permanentOwnedIds().length;
}
/**
 * Roll once and persist. Does NOT spend wins — the caller charges rollPrice() first (the shop owns
 * the balance). A legacy mark rolled for the first time also joins marks.js's owned set so it is
 * wearable through marks.js as before. Returns the result (plus the new state).
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
