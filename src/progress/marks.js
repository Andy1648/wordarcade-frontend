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
  return { mark: m.effect.winsMult };
}

/** The equipped mark's XP multiplier (×1 when it has none). Applied in the same stack as mastery. */
export function markXpMult(markId = getEquippedMark()) {
  const m = markById(markId);
  return m && m.effect && m.effect.xpMult ? m.effect.xpMult : 1;
}

/** The equipped mark's per-word chance to bump a word one rarity tier (0 when it has none). */
export function markRarityStep(markId = getEquippedMark()) {
  const m = markById(markId);
  return m && m.effect && m.effect.rarityStep ? m.effect.rarityStep : 0;
}

/** The equipped mark's chance that a broken combo survives (0 when it has none). */
export function markComboKeep(markId = getEquippedMark()) {
  const m = markById(markId);
  return m && m.effect && m.effect.comboKeep ? m.effect.comboKeep : 0;
}
