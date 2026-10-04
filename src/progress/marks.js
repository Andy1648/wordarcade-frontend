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
// STEP 49 (Andy oct2) — ONE MARKS SYSTEM, AND THE WORN MARK MATTERS. The shop's MOMENTUM "marks"
// are gone (the LETTER FORGE replaced them), so this is the only thing called a mark. Marks are
// COLLECTIBLES in four rarity TIERS; the one you wear is your MAIN — your title on the menu and the
// board — and it pays a REAL bonus on every word: COMMON +100%, RARE +150%, EPIC +200%,
// LEGENDARY +300% (rule 2 above was retired by Andy: "≥100%, not 10–25%"). Rank I–V still grows
// that bonus with the words you wear it for, and each mark keeps its small flavour perk on top.
// Marks unlock at LV 10 with a NEW SYSTEM reveal, and every new mark is a CLAIM (claims.js) — it
// is yours when you press CLAIM, with the REWARDS badge up until you do.
//
// Pure + guarded store. No DOM, no React.
import { queueClaim, registerClaimHandler } from './claims.js';

export const MARKS_EQUIPPED_KEY = 'taw.mark';
export const MARKS_OWNED_KEY = 'taw.marksOwned';
export const MARKS_UNLOCK_LEVEL = 10;
// The MAIN bonus by tier (the part above ×1). MARKS via ROLLS (Andy, PROGRESSION FINAL): the worn MAIN multiplies
// BOTH XP per letter and wins — COMMON ×1.1, RARE ×1.25, EPIC ×1.5, LEGENDARY ×3, MYTHIC ×10, SECRET ×25.
// GOLD doubles the bonus part, RAINBOW ×5 it (markRollsCore.mainMultOf). Ranks no longer scale the MAIN.
export const MARK_TIERS = {
  common: { name: 'COMMON', bonus: 0.1, colour: '#2EFFE0' },
  rare: { name: 'RARE', bonus: 0.25, colour: '#FFE94A' },
  epic: { name: 'EPIC', bonus: 0.5, colour: '#FF4FA3' },
  legendary: { name: 'LEGENDARY', bonus: 2, colour: '#FF6B3D' },
  mythic: { name: 'MYTHIC', bonus: 9, colour: '#9A1AFF' },
  secret: { name: 'SECRET', bonus: 24, colour: '#FFFFFF' },
};

// `effect` is the machine-readable version of `blurb`, read by markPayoutFactors() below and by
// the rarity roll in games. Keep the two in sync — the blurb is what the player is promised.
//   winsMult   : a flat multiplier on every word's wins in `mode` ('*' = every mode)
//   xpMult     : the same, on XP
//   rarityStep : a CHANCE per word to roll the word up one rarity tier
//   comboKeep  : a CHANCE that a broken combo is kept instead of reset
export const MARKS = [
  {
    id: 'mk-bomber',
    tier: 'common',
    name: 'BOMBER',
    icon: '💣',
    from: 'm-wb-5',
    blurb: '+25% wins in WORD BOMB.',
    effect: { winsMult: 1.25, mode: 'wordBomb' },
  },
  {
    id: 'mk-sprinter',
    tier: 'common',
    name: 'SPRINTER',
    icon: '⚡',
    from: 'm-blitz-5',
    blurb: '+25% wins in CATEGORY BLITZ.',
    effect: { winsMult: 1.25, mode: 'blitz' },
  },
  {
    id: 'mk-scholar',
    tier: 'rare',
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
    // MARK ROLLS (Andy oct3, decision 4): LINGUIST is a PERMANENT mark (sec-dict) and permanents pay MAIN ×4
    // — the LEGENDARY bonus. Was RARE ×2.5. Its flavour perk is unchanged.
    tier: 'legendary',
    name: 'LINGUIST',
    icon: '📖',
    from: 'sec-dict',
    blurb: '12% chance a word counts one RARITY TIER higher.',
    effect: { rarityStep: 0.12 },
  },
  {
    id: 'mk-metronome',
    tier: 'rare',
    name: 'METRONOME',
    icon: '🎯',
    from: 'wpm-70',
    blurb: '30% chance a broken COMBO survives.',
    effect: { comboKeep: 0.3 },
  },
  {
    id: 'mk-student',
    tier: 'common',
    name: 'STUDENT',
    icon: '📈',
    from: 'lv-15',
    blurb: '+20% wins in every mode.',
    effect: { xpMult: 1.2 },
  },
  {
    id: 'mk-magpie',
    tier: 'common',
    name: 'MAGPIE',
    icon: '🪙',
    from: 'dist-500',
    blurb: '+15% wins in every mode.',
    effect: { winsMult: 1.15 },
  },
  {
    id: 'mk-eternal',
    tier: 'legendary',
    name: 'ETERNAL',
    icon: '♾️',
    from: 'sec-eternal',
    blurb: '+50% more on top. The reward for ten rebirths.',
    effect: { winsMult: 1.5 },
  },
  // ---- STEP 49: eight more, so the collection has a long tail and every tier has a few ----
  { id: 'mk-linker', tier: 'common', name: 'LINKER', icon: '🔗', from: 'm-chain-5', blurb: '+25% wins in CHAIN.', effect: { winsMult: 1.25, mode: 'chain' } },
  { id: 'mk-veteran', tier: 'common', name: 'OLD HAND', // H6/M8: not VETERAN — that is the achievement that unlocks it
    icon: '🎖', from: 'lv-50', blurb: '+20% wins in every mode.', effect: { xpMult: 1.2 } },
  { id: 'mk-phoenix', tier: 'rare', name: 'PHOENIX', icon: '🔥', from: 'reb-1', blurb: '+20% wins in every mode.', effect: { winsMult: 1.2 } },
  { id: 'mk-smith', tier: 'rare', name: 'SMITH', icon: '🔨', from: 'forge-26', blurb: '+25% wins in SAT RUSH and CHAIN.', effect: { winsMult: 1.25, modes: ['satRush', 'chain'] } },
  // PERMANENT (dist-2500) → MAIN ×4, the LEGENDARY bonus (Andy oct3, decision 4). Was EPIC ×3.
  { id: 'mk-curator', tier: 'legendary', name: 'ARCHIVIST', // H6/M8: not CURATOR — that is the achievement that unlocks it
    icon: '🗂', from: 'dist-2500', blurb: '15% chance a word counts one RARITY TIER higher.', effect: { rarityStep: 0.15 } },
  { id: 'mk-pyro', tier: 'epic', name: 'PYRO', icon: '🧨', from: 'frenzy-1', blurb: '+40% wins in FUSE.', effect: { winsMult: 1.4, mode: 'fuse' } },
  { id: 'mk-nova', tier: 'epic', name: 'NOVA', icon: '✴', from: 'reb-5', blurb: '+25% wins in every mode.', effect: { winsMult: 1.25 } },
  { id: 'mk-legend', tier: 'legendary', name: 'LEGEND', icon: '👑', from: 'lv-300', blurb: '+40% wins in every mode.', effect: { xpMult: 1.4 } },
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
const MODE_LABEL = { wordBomb: 'WORD BOMB', blitz: 'CATEGORY BLITZ', satRush: 'SAT RUSH', chain: 'CHAIN', fuse: 'FUSE' };
const pct = (x) => `${Math.round(x * 100)}%`;
/** The promise, with THIS rank's numbers — what the picker prints and the payout pays. */
export function markBlurbAt(m, rank = 1) {
  if (!m) return '';
  const e = effectAtRank(m.effect, rank);
  // H6: honour `modes` (SMITH) — it read e.mode only, so SMITH promised "in every mode".
  const label = (k) => MODE_LABEL[k] || k;
  const where = e.modes && e.modes.length
    ? `in ${e.modes.map(label).join(' and ')}`
    : e.mode ? `in ${label(e.mode)}` : 'in every mode';
  // H6/M3: winsMult and xpMult are the SAME lever (perWordFactors folds both into BONUS). PROGRESSION
  // v11: BONUS pays WINS only — the level bar is credited level XP (KEY, rebirth, mode, word, streak) —
  // so both say "wins".
  // MARKS via ROLLS: the old per-mode wins / xp flavour is folded into the one MAIN (tier) — say what it pays.
  void where;
  if (e.winsMult || e.xpMult) return `MAIN ×${+markMainMult(m).toFixed(2)} on XP per letter and wins.`;
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

/** The MAIN a mark pays at base finish: 1 + its tier bonus. `rank` is accepted and IGNORED (MARKS via ROLLS: the
 *  MAIN is the tier's number everywhere — markRollsCore.markMult is the one payout function). */
// eslint-disable-next-line no-unused-vars
export function markMainMult(m, rank = 1) {
  if (!m) return 1;
  const t = MARK_TIERS[m.tier] || MARK_TIERS.common;
  return 1 + t.bonus;
}
export function markTier(m) {
  return MARK_TIERS[(m && m.tier) || 'common'];
}

function loadOwned() {
  try {
    const raw = localStorage.getItem(MARKS_OWNED_KEY);
    if (raw == null) return null;
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((id) => BY_ID.has(id)) : [];
  } catch {
    return null; // unreadable / blocked store: fall back to the achievement-derived set
  }
}
function saveOwned(ids) {
  try {
    localStorage.setItem(MARKS_OWNED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* blocked */
  }
}
export function ownedMarkIds() {
  return loadOwned() || [];
}
/** Claiming a NEW MARK makes it yours. */
registerClaimHandler('mark', (c) => {
  if (c && c.detail && BY_ID.has(c.detail)) saveOwned([...ownedMarkIds(), c.detail]);
});

/**
 * THE MARKS LAYER (STEP 49). Called on every menu return (achievements.checkAchievements). Until
 * the player reaches LV 10 (or has rebirthed) marks are not a thing yet. The first time they are,
 * a NEW SYSTEM claim reveals them. After that, every mark whose achievement is earned and that the
 * player does not own yet becomes a NEW MARK claim. A save from before this step keeps every mark
 * it had (migrated straight to owned, no claims).
 */
export function checkMarkClaims({ level = 1, rebirths = 0, earned = [] } = {}) {
  const earnedSet = earned instanceof Set ? earned : new Set(earned);
  let owned = loadOwned();
  if (owned == null) {
    // migration: an existing save owns exactly what it had unlocked
    owned = MARKS.filter((m) => earnedSet.has(m.from)).map((m) => m.id);
    saveOwned(owned);
    if (owned.length) saveRevealed();
  }
  if (!isRevealed()) {
    if (level < MARKS_UNLOCK_LEVEL && rebirths < 1) return [];
    saveRevealed();
    queueClaim({
      id: 'layer-marks',
      kind: 'layer',
      label: 'NEW SYSTEM — MARKS',
      detail: 'marks',
      meta: { blurb: 'Roll and earn MARKS. WEAR ONE as your title: ×1.1 COMMON up to ×25 SECRET on XP per letter and wins.' },
    });
  }
  const queued = [];
  for (const m of MARKS) {
    if (!earnedSet.has(m.from) || owned.includes(m.id)) continue;
    const c = queueClaim({ id: `mark-${m.id}`, kind: 'mark', label: `NEW MARK — ${m.name}`, detail: m.id, meta: { tier: m.tier } });
    if (c) queued.push(c);
  }
  return queued;
}
const REVEALED_KEY = 'taw.marksRevealed';
function isRevealed() {
  try {
    return localStorage.getItem(REVEALED_KEY) === '1';
  } catch {
    return true;
  }
}
function saveRevealed() {
  try {
    localStorage.setItem(REVEALED_KEY, '1');
  } catch {
    /* blocked */
  }
}
export function marksRevealed() {
  return isRevealed();
}

/**
 * Which marks the player has UNLOCKED, given the set of earned achievement ids. A mark is unlocked
 * by its source achievement and by nothing else — there is no separate currency or grind.
 */
export function unlockedMarks(earnedAchievementIds = []) {
  // STEP 49: a mark is yours once CLAIMED (taw.marksOwned). A save that has never been through the
  // marks layer (no owned key yet) falls back to its earned achievements, as before.
  const owned = loadOwned();
  if (owned != null) return MARKS.filter((m) => owned.includes(m.id));
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
 * Returns {} when nothing is equipped.
 *
 * MARKS via ROLLS: the MAIN only (tier, base finish) in every mode — the old per-mode flavour multiplier is
 * folded into the tier. The PAYOUT reads markRollsCore.markMult (MAIN × GOLD/RAINBOW × the INDEX bonus), the
 * one function XP per letter reads too; this stays for callers that want a legacy mark's base MAIN.
 */
export function markWinsFactors({ markId = getEquippedMark() } = {}) {
  const m = markById(markId);
  if (!m) return {};
  return { mark: markMainMult(m) };
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

// MARKS via ROLLS: a wins / xp flavour mark's promise IS its MAIN now — keep every static blurb (the menu chip's
// title, the claim card) saying the number the payout pays. Run last: markBlurbAt reads MODE_LABEL above.
for (const m of MARKS) {
  const e = m.effect || {};
  if (e.winsMult || e.xpMult) m.blurb = markBlurbAt(m, 1);
}
