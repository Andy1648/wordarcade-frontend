// markRolls.js — MARK ROLLS: spend GEMS on a random mark, Sol's RNG / Blox Fruits gacha style.
// MARKS via ROLLS (Andy, PROGRESSION FINAL — turned on with the Rebirth Rush economy). Feel notes:
// claude/econ-oct2/rolls-rr-notes.md.
//
// THE SHAPE
//   - Six tiers, Andy's odds: COMMON 1 IN 2, RARE 1 IN 10, EPIC 1 IN 100, LEGENDARY 1 IN 1,000,
//     MYTHIC 1 IN 10,000, SECRET 1 IN 100,000 (the tier's chance; its marks split it evenly; COMMON is
//     the remainder). The pool, the MAIN math and markMult() live in markRollsCore.js.
//   - LUCK multiplies every non-common chance (Sol's shape). Commons take what is left, so luck
//     removes trash rather than breaking the table.
//   - PITY (the ladder, always visible): EPIC-or-better guaranteed at least every 50 rolls (soft from 40), the first
//     by roll 10; LEGENDARY-or-better guaranteed at least every 500. The counters are state, so the UI can show them.
//   - DUPES → ★ PIPS (markRollsCore): COMMON 10 / RARE 5 / EPIC 3 / LEGENDARY 2 / MYTHIC+ 1 dupes a pip, ★5 max,
//     each pip +20% of that mark's stat.
//   - The INDEX (% collected) pays a small permanent bonus (+0.5% per %) + LUCK at milestones; each NEW mark, each ★
//     and each completed tier pays wins (words at your rate).
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
  freshState, normalize, markLevel, mainMultOf, loadRollState, saveRollState, num, collection, SHINY_CHANCE, isShiny,
  LEGENDARY_PITY_HARD, LEGACY_GOLD_K, LEGACY_RAINBOW_K, markLuck, INDEX_NEW_WORDS, INDEX_PIP_WORDS, INDEX_COMPLETE_WORDS,
  ROLLABLE_TIERS, SKIP_TIERS, DEFAULT_SKIP_BELOW, statOf, statLine, perkLine,
} from './markRollsCore.js';

export * from './markRollsCore.js';
import { SEASON2 as S2_ON, V3 as S2_V3 } from './season.js'; // V3.unlocks: installed lazily
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
  legendary: { hard: LEGENDARY_PITY_HARD }, // LEGENDARY-or-better guaranteed on roll 500 of a drought (Andy oct5)
  firstEpicBy: 10, // the first EPIC+ ever lands by roll 10
};
export const LUCK_SOURCES = {
  permanent: 0.1, // each PERMANENT (hard-achievement) mark owned
  pip: 0.01, // each ★ pip of each mark (★5 everywhere: +1.45)
  legacyGold: 0.02, // a mark that was GOLD before v2 keeps at least this (its old luck)
  legacyRainbow: 0.05, // a mark that was RAINBOW before v2 keeps at least this
  boost: 1.0, // while a BOOST runs
};
export const BONUS_ROLL_EVERY = 10; // every 10th roll ×2 luck ("×2 LUCK READY")
export const BONUS_ROLL_MULT = 2;
export const ROLL_UNLOCK_LEVEL = 10; // with MARKS (marks.js MARKS_UNLOCK_LEVEL), or any rebirth
// PRICE (Andy oct5, GEMS): a roll costs gems.ROLL_PRICE_GEMS (10 GEMS). Wins never buy rolls. (The old wins price —
// words at your rate — is gone from the roll path; gemsMigrate.js keeps it only to size the starting grant.)

function milestonesReached(state) {
  const c = collection(state);
  const at = { base: c.pct, gold: c.goldPct, rainbow: c.rainbowPct };
  return COLLECTION_MILESTONES.filter((m) => at[m.track] >= m.pct - 1e-9).map((m) => m.id);
}

/**
 * LUCK. luck = (1 + Σ additive) × (×2 on every 10th roll). ctx: { permanentOwned (count), boost (bool),
 * markLuck (the worn MAIN's +N% ROLL LUCK as an addend; omitted → read from the worn mark) }. Additive: each
 * PERMANENT mark +0.10, each ★ pip +0.01 (a pre-v2 GOLD / RAINBOW mark keeps at least +0.02 / +0.05), each paid
 * INDEX milestone its luck, the worn ROLL LUCK stat, a live BOOST +1.0.
 */
export function luck(state, ctx = {}) {
  let add = 0;
  add += LUCK_SOURCES.permanent * num(ctx.permanentOwned);
  for (const m of ROLL_MARKS) {
    const lv = markLevel(state, m.id);
    const floor = lv.k >= LEGACY_RAINBOW_K ? LUCK_SOURCES.legacyRainbow : lv.k >= LEGACY_GOLD_K ? LUCK_SOURCES.legacyGold : 0;
    add += Math.max(LUCK_SOURCES.pip * lv.pips, floor);
  }
  const ml = Number.isFinite(ctx.markLuck) ? ctx.markLuck : markLuck({ state });
  if (ml > 0) add += ml;
  for (const id of state.milestones || []) {
    const ms = COLLECTION_MILESTONES.find((x) => x.id === id);
    if (ms) add += ms.luck;
  }
  if (ctx.boost) add += LUCK_SOURCES.boost;
  return (1 + add) * (S2_ON ? S2_V3.unlocks.unlockLuckMult() : 1); // v3 (SEASON2): the R7 unlock LUCK ×1.25 (×1 otherwise / flag OFF)
}
export function isBonusRoll(state) {
  return (num(state.rolls) + 1) % BONUS_ROLL_EVERY === 0;
}
/** The shown pity counters: rolls left until each guarantee (1 = the next roll is guaranteed). */
export function pityLeft(state) {
  const st = state || freshState();
  const epicHard = !st.everEpic ? Math.min(PITY.epic.hard, PITY.firstEpicBy - num(st.rolls)) : PITY.epic.hard - num(st.sinceEpic);
  return { epic: Math.max(1, epicHard), legendary: Math.max(1, PITY.legendary.hard - num(st.sinceLegendary)) };
}
/** THE PITY LADDER (always visible): [{ tier: 'epic', left }, { tier: 'legendary', left }] — "EPIC+ IN 50". */
export function pityLadder(state) {
  const p = pityLeft(state);
  return [{ tier: 'epic', left: p.epic }, { tier: 'legendary', left: p.legendary }];
}

/**
 * The exact chance of every mark on the NEXT roll, given state + ctx. Returns { probs: Map id→p,
 * forced: null|'epic'|'legendary', luck, bonus }. The probabilities sum to 1.
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
  if (num(state.sinceLegendary) + 1 >= PITY.legendary.hard) forced = 'legendary';
  const probs = new Map();
  if (forced) {
    const group = forced === 'legendary' ? ROLL_MARKS.filter((m) => tierRank(m.tier) >= tierRank('legendary')) : epicPlus;
    const s = sumOf(group);
    for (const m of ROLL_MARKS) probs.set(m.id, group.includes(m) ? w.get(m.id) / s : 0);
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
 * boost, markLuck }. result: { markId, tier, oneInX, dupe, newMark (a first-time mark: ALWAYS the full reveal),
 * copies, pips, pipUp (this copy earned a ★), have, need (the "7/10 → ★3" line), firstRoll (the roll # it was first
 * rolled), pityHit ('epic'|'legendary'|null), bonusRoll, luck, milestones (newly reached ids), shiny (THIS roll came
 * up shiny), shinyNew (it made the mark shiny for the first time), completed (the tier this roll completed, or
 * null), rewards ([{ kind: 'new'|'pip'|'complete', tier, words }]), rewardWords (their sum — the caller pays it in
 * words at your rate) }.
 * SHINY is a second draw from the same rng AFTER the pick: a flat SHINY_CHANCE, untouched by luck and pity.
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
  const sh = rng();
  const shiny = sh >= 0 && sh < SHINY_CHANCE;
  const wasShiny = isShiny(pick.id, s0);
  const before = markLevel(s0, pick.id);
  const s = { ...s0, marks: { ...s0.marks }, milestones: [...s0.milestones], done: [...(s0.done || [])] };
  s.rolls = s0.rolls + 1;
  const prev = s0.marks[pick.id] || {};
  const entry = { ...prev, n: before.copies + 1 };
  if (shiny || wasShiny) entry.shiny = true;
  if (before.copies === 0 && !entry.first) entry.first = s.rolls;
  s.marks[pick.id] = entry;
  const after = markLevel(s, pick.id);
  const tr = tierRank(pick.tier);
  s.sinceEpic = tr >= tierRank('epic') ? 0 : s0.sinceEpic + 1;
  s.sinceLegendary = tr >= tierRank('legendary') ? 0 : num(s0.sinceLegendary) + 1;
  if (tr >= tierRank('epic')) s.everEpic = true;
  const had = new Set(s0.milestones);
  const reached = milestonesReached(s).filter((id) => !had.has(id));
  s.milestones.push(...reached);
  // INDEX REWARDS: a NEW mark, a ★ level-up, the tier's completion (once)
  const rewards = [];
  if (before.copies === 0) rewards.push({ kind: 'new', tier: pick.tier, words: INDEX_NEW_WORDS[pick.tier] || 0 });
  if (after.pips > before.pips) rewards.push({ kind: 'pip', tier: pick.tier, words: INDEX_PIP_WORDS[pick.tier] || 0 });
  let completed = null;
  if (!s.done.includes(pick.tier) && ROLL_MARKS.filter((m) => m.tier === pick.tier).every((m) => s.marks[m.id])) {
    s.done.push(pick.tier);
    completed = pick.tier;
    rewards.push({ kind: 'complete', tier: pick.tier, words: INDEX_COMPLETE_WORDS[pick.tier] || 0 });
  }
  return {
    state: s,
    result: {
      markId: pick.id,
      tier: pick.tier,
      oneInX: oneInX(pick.id),
      dupe: before.copies > 0,
      newMark: before.copies === 0,
      copies: after.copies,
      pips: after.pips,
      pipUp: after.pips > before.pips,
      have: after.have,
      need: after.need,
      firstRoll: entry.first || null,
      pityHit: forced,
      bonusRoll: bonus,
      luck: L,
      milestones: reached,
      shiny,
      shinyNew: shiny && !wasShiny,
      completed,
      rewards,
      rewardWords: rewards.reduce((t, r) => t + r.words, 0),
    },
  };
}

// ----------------------------------------------------------------------------------- INDEX reward rate
/**
 * The reference word's wins at the player's live rate (Word Bomb, 5 letters) WITHOUT the timed boosts AND WITHOUT
 * the MARK (perWordFactors `bonus`: worn MAIN × INDEX) — what the INDEX rewards (words at your rate) pay per word.
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
/** An INDEX milestone's wins lump. v2: milestones pay LUCK only (the wins moved to indexRewardWins) → 0. Kept for
 *  old callers. */
// eslint-disable-next-line no-unused-vars
export function milestoneWins(id, rate = 0) {
  return 0;
}
/** A roll result's INDEX rewards (new mark / ★ / completion) in wins: rewardWords × the reference word (`rate`). */
export function indexRewardWins(result, rate = 0) {
  const w = result && Number.isFinite(result.rewardWords) ? result.rewardWords : 0;
  return w > 0 && rate > 0 ? Math.round(w * rate) : 0;
}
// AUTO-EQUIP: a roll auto-equips WHENEVER its STRENGTH (mainMultOf — the stat's equivalent multiplier, so kinds
// compare) is HIGHER than the worn MAIN's — always when nothing is worn
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
    s.marks[id] = { ...s.marks[id], n: Math.max(n, 1) };
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
 * Roll once and persist. Does NOT spend — the caller charges ROLL_PRICE_GEMS first (markRollShop owns
 * the gems). A legacy mark rolled for the first time also joins marks.js's owned set so it is
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

// ------------------------------------------------------------------------------ settings + INDEX
/** "Skip reveals below [tier]" (default EPIC). A first-time mark ALWAYS plays the full reveal (shouldSkipReveal). */
export function getSkipBelow(state = loadRollState()) {
  return state && SKIP_TIERS.includes(state.skipBelow) ? state.skipBelow : DEFAULT_SKIP_BELOW;
}
/** Store the skip setting in taw.markRolls (no migration side effects: a never-rolled save stays empty). */
export function setSkipBelow(tier) {
  if (!SKIP_TIERS.includes(tier)) return getSkipBelow();
  const s = normalize(loadRollState() || freshState());
  saveRollState({ ...s, skipBelow: tier });
  return tier;
}
/** True when this result's reveal may be skipped: below the setting AND not a first-time mark. */
export function shouldSkipReveal(result, skipBelow = getSkipBelow()) {
  if (!result || result.newMark) return false;
  const t = SKIP_TIERS.includes(skipBelow) ? skipBelow : DEFAULT_SKIP_BELOW;
  return tierRank(result.tier) < tierRank(t);
}
/**
 * One INDEX card's data: { id, name, tier, oneInX, owned (copies), firstRoll (roll #, null if unknown/unowned),
 * pips, have, need (the "7/10 → ★3" line; need 0 at ★5), stat ({ kind, value } as it pays), statLine, shiny,
 * perk (LEGENDARY+ perk line or '') }, or null for an unknown id. `state` omitted → viewState().
 */
export function indexEntry(id, state) {
  const m = ROLL_BY_ID.get(id);
  if (!m) return null;
  const s = state === undefined ? viewState() : state;
  const lv = markLevel(s, id);
  const e = s && s.marks ? s.marks[id] : null;
  return {
    id, name: m.name, tier: m.tier, oneInX: oneInX(id), owned: lv.copies, firstRoll: (e && num(e.first)) || null,
    pips: lv.pips, have: lv.have, need: lv.need, stat: statOf(id, s), statLine: statLine(id, s), shiny: isShiny(id, s),
    perk: perkLine(id),
  };
}
/** The tiers whose every mark this state owns (each pays INDEX_COMPLETE_WORDS once). */
export function completedTiers(state) {
  return ROLLABLE_TIERS.filter((t) => ROLL_MARKS.filter((m) => m.tier === t).every((m) => markLevel(state, m.id).copies > 0));
}
