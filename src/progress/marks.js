// marks.js — MARKS: a permanent equippable badge, earned rather than bought.
//
// WHY. Every other reward in the game is a NUMBER that goes up — wins, XP, a tier. Achievements
// and secrets pay one lump and are then over: nothing you did is still doing anything for you an
// hour later. A MARK is the other kind of reward, the Bee Swarm Simulator one: a thing you earned
// that you then CHOOSE to wear, and which changes how you play while you wear it.
//
// THE DESIGN RULES, all three load-bearing:
//   1. ONE SLOT. A mark is a decision, not a collection of passive bonuses — you give something up
//      to wear the one you want. Eight marks and one slot is eight different builds; eight marks
//      and eight slots is one build with eight bonuses bolted on.
//   2. SMALL EFFECTS. Every mark is a modest multiplier or a small chance, in the 1.1-1.5 band.
//      A mark must be worth equipping and must never be the reason a number is large — that is
//      what Key Power, rebirth and the level curve are for.
//   3. VISIBLE IN THE PAYOUT. Every mark's effect appears as a named row in the payout breakdown
//      (progress/payout.js) when it fires. A permanent bonus nobody can see is the exact defect
//      this whole branch exists to fix; shipping a new invisible one would be absurd.
//
// Marks are earned from ACHIEVEMENTS and SECRETS (`from` is an achievement id), so they are the
// reason to chase those beyond the one-off payout. They SURVIVE rebirth — their own storage key,
// untouched by doRebirth.
//
// Pure + guarded store. No DOM, no React.

export const MARKS_EQUIPPED_KEY = 'taw.mark';

// `effect` is the machine-readable version of `blurb`, read by markPayoutFactors() below and by
// the rarity roll in games. Keep the two in sync — the blurb is what the player is promised.
//   winsMult   : a flat multiplier on every word's wins in `mode` ('*' = every mode)
//   xpMult     : the same, on XP
//   rarityStep : a CHANCE per word to roll the word up one rarity tier
//   comboKeep  : a CHANCE that a broken combo is kept instead of reset
export const MARKS = [
  {
    id: 'mk-bomber',
    name: 'BOMBER',
    icon: '💣',
    from: 'm-wb-5',
    blurb: '+25% wins in WORD BOMB.',
    effect: { winsMult: 1.25, mode: 'wordBomb' },
  },
  {
    id: 'mk-sprinter',
    name: 'SPRINTER',
    icon: '⚡',
    from: 'm-blitz-5',
    blurb: '+25% wins in CATEGORY BLITZ.',
    effect: { winsMult: 1.25, mode: 'blitz' },
  },
  {
    id: 'mk-scholar',
    // SAVANT, not SCHOLAR: the achievement that unlocks it is already called SCHOLAR, and a locked
    // card reading "SCHOLAR — unlocks with SCHOLAR" reads as a bug.
    name: 'SAVANT',
    icon: '🎓',
    from: 'm-sat-5',
    blurb: '+40% wins in SAT RUSH.',
    effect: { winsMult: 1.4, mode: 'satRush' },
  },
  {
    id: 'mk-linguist',
    name: 'LINGUIST',
    icon: '📖',
    from: 'sec-dict',
    blurb: '12% chance a word counts one RARITY TIER higher.',
    effect: { rarityStep: 0.12 },
  },
  {
    id: 'mk-metronome',
    name: 'METRONOME',
    icon: '🎯',
    from: 'wpm-70',
    blurb: '30% chance a broken COMBO survives.',
    effect: { comboKeep: 0.3 },
  },
  {
    id: 'mk-student',
    name: 'STUDENT',
    icon: '📈',
    from: 'lv-15',
    blurb: '+20% XP in every mode.',
    effect: { xpMult: 1.2 },
  },
  {
    id: 'mk-magpie',
    name: 'MAGPIE',
    icon: '🪙',
    from: 'dist-500',
    blurb: '+15% wins in every mode.',
    effect: { winsMult: 1.15 },
  },
  {
    id: 'mk-eternal',
    name: 'ETERNAL',
    icon: '♾️',
    from: 'sec-eternal',
    blurb: '+50% wins in every mode. The reward for ten rebirths.',
    effect: { winsMult: 1.5 },
  },
];

const BY_ID = new Map(MARKS.map((m) => [m.id, m]));

// ---- MARK RANKS (STEP 21 / Andy A3: "marks need a better system") -------------------------------
// A worn mark GROWS. Every accepted in-game word typed while wearing it counts toward that mark's
// rank, I → V, and each rank scales the mark's BONUS (the part above ×1, or the chance) — so a mark
// you've lived in is visibly better than one you just put on, and switching marks is a real cost.
// Bounded: rank V is 1.6× the rank-I bonus (+25% → +40%; ETERNAL +50% → +80%; a 30% chance → 48%),
// so rule 2 still holds — a mark is never the reason a number is large.
export const MARK_WORDS_KEY = 'taw.markWords';
export const MARK_RANK_WORDS = [0, 150, 500, 1500, 4000]; // words worn to REACH rank I..V
export const MARK_RANK_SCALE = [1, 1.15, 1.3, 1.45, 1.6];
export const MARK_RANK_NAMES = ['I', 'II', 'III', 'IV', 'V'];
export const MAX_MARK_RANK = MARK_RANK_WORDS.length; // 5

function loadMarkWords() {
  try {
    const o = JSON.parse(localStorage.getItem(MARK_WORDS_KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
export function markWords(id) {
  const n = Number(loadMarkWords()[id]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
/** Rank 1..5 for a words-worn count. */
export function rankForWords(words) {
  let r = 1;
  for (let i = 0; i < MARK_RANK_WORDS.length; i += 1) if (words >= MARK_RANK_WORDS[i]) r = i + 1;
  return r;
}
export function markRank(id) {
  return rankForWords(markWords(id));
}
/** { rank, words, into, need, frac, maxed } — the picker's progress bar to the next rank. */
export function markProgress(id) {
  const words = markWords(id);
  const rank = rankForWords(words);
  if (rank >= MAX_MARK_RANK) return { rank, words, into: 0, need: 0, frac: 1, maxed: true };
  const lo = MARK_RANK_WORDS[rank - 1];
  const hi = MARK_RANK_WORDS[rank];
  return { rank, words, into: words - lo, need: hi - lo, frac: (words - lo) / (hi - lo), maxed: false };
}
/** Credit one accepted word to the EQUIPPED mark. Returns { id, rank, rankedUp } or null. */
export function addMarkWord(id = getEquippedMark()) {
  if (!id || !BY_ID.has(id)) return null;
  const all = loadMarkWords();
  const before = rankForWords(Number(all[id]) || 0);
  all[id] = (Number(all[id]) || 0) + 1;
  try {
    localStorage.setItem(MARK_WORDS_KEY, JSON.stringify(all));
  } catch {
    return null;
  }
  const rank = rankForWords(all[id]);
  return { id, rank, rankedUp: rank > before };
}
/** A mark's effect at a rank: every bonus scaled by MARK_RANK_SCALE (mode unchanged). */
export function effectAtRank(effect = {}, rank = 1) {
  const k = MARK_RANK_SCALE[Math.max(1, Math.min(MAX_MARK_RANK, rank)) - 1];
  const out = { ...effect };
  if (effect.winsMult) out.winsMult = 1 + (effect.winsMult - 1) * k;
  if (effect.xpMult) out.xpMult = 1 + (effect.xpMult - 1) * k;
  if (effect.rarityStep) out.rarityStep = effect.rarityStep * k;
  if (effect.comboKeep) out.comboKeep = effect.comboKeep * k;
  return out;
}
const MODE_LABEL = { wordBomb: 'WORD BOMB', blitz: 'CATEGORY BLITZ', satRush: 'SAT RUSH' };
const pct = (x) => `${Math.round(x * 100)}%`;
/** The promise, with THIS rank's numbers — what the picker prints and the payout pays. */
export function markBlurbAt(m, rank = 1) {
  if (!m) return '';
  const e = effectAtRank(m.effect, rank);
  const where = e.mode ? `in ${MODE_LABEL[e.mode] || e.mode}` : 'in every mode';
  if (e.winsMult) return `+${pct(e.winsMult - 1)} wins ${where}.`;
  if (e.xpMult) return `+${pct(e.xpMult - 1)} XP ${where}.`;
  if (e.rarityStep) return `${pct(e.rarityStep)} chance a word counts one RARITY TIER higher.`;
  if (e.comboKeep) return `${pct(e.comboKeep)} chance a broken COMBO survives.`;
  return m.blurb;
}
function rankedEffect(m) {
  return effectAtRank(m.effect, markRank(m.id));
}
export function markById(id) {
  return BY_ID.get(id) || null;
}

/**
 * Which marks the player has UNLOCKED, given the set of earned achievement ids. A mark is unlocked
 * by its source achievement and by nothing else — there is no separate currency or grind.
 */
export function unlockedMarks(earnedAchievementIds = []) {
  const earned = earnedAchievementIds instanceof Set ? earnedAchievementIds : new Set(earnedAchievementIds);
  return MARKS.filter((m) => earned.has(m.from));
}

export function getEquippedMark() {
  try {
    const raw = localStorage.getItem(MARKS_EQUIPPED_KEY);
    return raw && BY_ID.has(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Equip a mark. Refuses one that is not unlocked, so a hand-edited storage key cannot grant an
 * effect. `null` un-equips (an empty slot is a legitimate choice).
 */
export function equipMark(id, earnedAchievementIds = []) {
  if (id == null) {
    try {
      localStorage.removeItem(MARKS_EQUIPPED_KEY);
    } catch {
      /* storage blocked */
    }
    return null;
  }
  const ok = unlockedMarks(earnedAchievementIds).some((m) => m.id === id);
  if (!ok) return getEquippedMark();
  try {
    localStorage.setItem(MARKS_EQUIPPED_KEY, id);
  } catch {
    /* storage blocked */
  }
  return id;
}

/**
 * The equipped mark's contribution to ONE word's payout, as a named factor object that drops
 * straight into buildPayout()'s `factors` — which is how rule 3 is kept: a mark cannot change a
 * payout without appearing in the receipt, because the receipt is built from this same object.
 *
 * Returns {} when nothing is equipped or the mark does not affect wins in this mode.
 */
export function markWinsFactors({ markId = getEquippedMark(), mode } = {}) {
  const m = markById(markId);
  if (!m || !m.effect || !m.effect.winsMult) return {};
  if (m.effect.mode && m.effect.mode !== mode) return {};
  return { mark: rankedEffect(m).winsMult };
}

/** The equipped mark's XP multiplier (×1 when it has none). Applied in the same stack as mastery. */
export function markXpMult(markId = getEquippedMark()) {
  const m = markById(markId);
  return m && m.effect && m.effect.xpMult ? rankedEffect(m).xpMult : 1;
}

/** The equipped mark's per-word chance to bump a word one rarity tier (0 when it has none). */
export function markRarityStep(markId = getEquippedMark()) {
  const m = markById(markId);
  return m && m.effect && m.effect.rarityStep ? rankedEffect(m).rarityStep : 0;
}

/** The equipped mark's chance that a broken combo survives (0 when it has none). */
export function markComboKeep(markId = getEquippedMark()) {
  const m = markById(markId);
  return m && m.effect && m.effect.comboKeep ? rankedEffect(m).comboKeep : 0;
}

// ---- "NEW MARK" badge (STEP 21): which unlocked marks the player has looked at in the picker. -----
export const MARKS_SEEN_KEY = 'taw.marksSeen';
export function hasUnseenMarks(unlockedIds = []) {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(MARKS_SEEN_KEY) || '[]'));
    return unlockedIds.some((id) => !seen.has(id));
  } catch {
    return false;
  }
}
export function markMarksSeen(unlockedIds = []) {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(MARKS_SEEN_KEY) || '[]'));
    for (const id of unlockedIds) seen.add(id);
    localStorage.setItem(MARKS_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    /* storage blocked */
  }
}

// ---- mark RANK-UP news (STEP 21): the rank this browser last celebrated, per mark. ----------------
const MARK_RANK_SEEN_KEY = 'taw.markRankSeen';
/** Returns the new rank if `id` ranked up since it was last celebrated (and records it), else 0. */
export function takeMarkRankUp(id) {
  if (!id || !BY_ID.has(id)) return 0;
  try {
    const seen = JSON.parse(localStorage.getItem(MARK_RANK_SEEN_KEY) || '{}') || {};
    const now = markRank(id);
    const before = Number(seen[id]) || 1;
    if (now !== before) {
      seen[id] = now;
      localStorage.setItem(MARK_RANK_SEEN_KEY, JSON.stringify(seen));
    }
    return now > before ? now : 0;
  } catch {
    return 0;
  }
}
