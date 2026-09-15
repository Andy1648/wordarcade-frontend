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

// ---------------------------------------------------------------- MARK SLOTS (variant, flagged)
//
// Rule 1 above says ONE SLOT, and it gives the reason: "eight marks and one slot is eight
// different builds; eight marks and eight slots is one build with eight bonuses bolted on."
// MEASURED (`claude/marks-slots-sim.mjs`), rule 1 is not achieving that at one slot — ETERNAL
// (+50% wins, every mode) dominates seven of the eight, so every mode wears the same mark and the
// other seven are never chosen by anyone who has it. At TWO slots the mode-specific marks come
// alive (BOMBER / SPRINTER / SAVANT get picked); at THREE only LINGUIST and STUDENT stay idle, and
// STUDENT is XP-only so a WINS sim structurally cannot value it.
//
// Slots also NARROW the mode spread rather than widening it (1.90x -> 1.56x -> 1.49x), because the
// mode-specific marks exist only for the weaker modes — so the 2.00x mode-spread invariant is not
// what constrains slot count. Rule 1 is.
//
// So this is a VARIANT, not a change: `?markslots=2` / `?markslots=3`. With no flag the count is 1
// and every function below takes the same path it always did, reading the same single storage key
// — slots=1 is byte-identical to shipped behaviour, asserted in marks.test.js. Whether to ship 2
// is a design decision, not one this file makes.
//
// Read ONCE at module load: it is a dev/QA flag, nobody toggles it mid-session, and re-reading the
// URL per payout would put a parse on a per-word path.
export const MARKS_EQUIPPED_LIST_KEY = 'taw.marks';
export const MARK_SLOTS = (() => {
  if (typeof window === 'undefined') return 1;
  try {
    const n = Number(new URLSearchParams(window.location.search).get('markslots'));
    return Number.isFinite(n) && n >= 1 && n <= 3 ? Math.floor(n) : 1;
  } catch {
    return 1;
  }
})();

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
 * Every equipped mark, newest-last, capped at MARK_SLOTS and filtered to ids that still exist.
 *
 * At ONE slot this is exactly `[getEquippedMark()]` minus the null — it reads the SAME legacy key
 * and never touches the list key, so a player who never sees the flag is on the identical code
 * path as before. Above one slot it reads the list key and falls back to the single key, so
 * turning the flag on for an existing save carries the mark they were already wearing into slot 1
 * rather than silently un-equipping them.
 */
export function getEquippedMarks() {
  if (MARK_SLOTS <= 1) {
    const one = getEquippedMark();
    return one ? [one] : [];
  }
  let ids = [];
  try {
    const raw = localStorage.getItem(MARKS_EQUIPPED_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed;
    }
  } catch {
    ids = [];
  }
  if (!ids.length) {
    const one = getEquippedMark();
    if (one) ids = [one];
  }
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (typeof id === 'string' && BY_ID.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
    if (out.length >= MARK_SLOTS) break;
  }
  return out;
}

/**
 * Toggle a mark in the multi-slot loadout. Worn -> taken off; not worn -> worn if a slot is free.
 * When every slot is full this is a NO-OP returning the loadout unchanged: silently displacing a
 * mark the player chose is worse than refusing, and the picker greys the locked-out cards so the
 * refusal is visible rather than mysterious. Refuses anything not unlocked, exactly as equipMark
 * does — a hand-edited storage key must not grant an effect.
 */
export function toggleMarkSlot(id, earnedAchievementIds = []) {
  const current = getEquippedMarks();
  if (id == null) return current;
  const i = current.indexOf(id);
  let next;
  if (i >= 0) {
    next = current.filter((x) => x !== id);
  } else {
    if (current.length >= MARK_SLOTS) return current;
    if (!unlockedMarks(earnedAchievementIds).some((m) => m.id === id)) return current;
    next = [...current, id];
  }
  try {
    localStorage.setItem(MARKS_EQUIPPED_LIST_KEY, JSON.stringify(next));
    // Keep the legacy single key in step with slot 1, so anything still reading it — and a
    // downgrade back to one slot — sees a coherent loadout rather than a stale mark.
    if (next.length) localStorage.setItem(MARKS_EQUIPPED_KEY, next[0]);
    else localStorage.removeItem(MARKS_EQUIPPED_KEY);
  } catch {
    /* storage blocked */
  }
  return next;
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
export function markWinsFactors({ markId, markIds, mode } = {}) {
  // ONE NAMED KEY PER PAYING MARK — rule 3, carried into multi-slot. Returning a single
  // pre-multiplied `mark` would keep the arithmetic right and make the RECEIPT lie: two marks
  // would pay through one row labelled MARK, which is precisely the invisible standing bonus this
  // system exists to abolish. Keys are `mark`, `mark2`, `mark3` and each has its own row in
  // payout.js. At one slot only `mark` is ever emitted, so the receipt is unchanged.
  const ids = markIds || (markId !== undefined ? (markId == null ? [] : [markId]) : getEquippedMarks());
  const out = {};
  let n = 0;
  for (const id of ids) {
    const m = markById(id);
    if (!m || !m.effect || !m.effect.winsMult) continue;
    if (m.effect.mode && m.effect.mode !== mode) continue;
    n += 1;
    out[n === 1 ? 'mark' : `mark${n}`] = m.effect.winsMult;
  }
  return out;
}

/** Every mark-name a payout row belongs to, keyed by factor key — so the receipt can label
 *  `mark2` with the mark actually paying rather than a generic "MARK 2". */
export function markRowNames({ markIds, mode } = {}) {
  const ids = markIds || getEquippedMarks();
  const out = {};
  let n = 0;
  for (const id of ids) {
    const m = markById(id);
    if (!m || !m.effect || !m.effect.winsMult) continue;
    if (m.effect.mode && m.effect.mode !== mode) continue;
    n += 1;
    out[n === 1 ? 'mark' : `mark${n}`] = m.name;
  }
  return out;
}

/** The equipped mark's XP multiplier (×1 when it has none). Applied in the same stack as mastery. */
export function markXpMult(markId) {
  // Multiplicative across slots. At one slot the loop runs once and this is the old expression.
  const ids = markId !== undefined ? (markId == null ? [] : [markId]) : getEquippedMarks();
  let mult = 1;
  for (const id of ids) {
    const m = markById(id);
    if (m && m.effect && m.effect.xpMult) mult *= m.effect.xpMult;
  }
  return mult;
}

/** The equipped mark's per-word chance to bump a word one rarity tier (0 when it has none). */
export function markRarityStep(markId) {
  // COMBINED AS INDEPENDENT ROLLS: 1 - prod(1 - p). Two 30% chances are 51%, not 60% — adding
  // them would let three slots exceed certainty. With a single mark this reduces exactly to p, so
  // one slot is unchanged. (Today only one mark carries each of these two effects, so the stack
  // is unreachable in practice; it is written correctly anyway rather than left to be discovered.)
  const ids = markId !== undefined ? (markId == null ? [] : [markId]) : getEquippedMarks();
  const ps = [];
  for (const id of ids) {
    const m = markById(id);
    if (m && m.effect && m.effect.rarityStep) ps.push(m.effect.rarityStep);
  }
  // RETURN THE SINGLE VALUE UNTOUCHED. `1 - (1 - 0.3)` is 0.30000000000000004, not 0.3 — the
  // general formula does NOT reduce exactly to p in floating point, and the existing test caught
  // it. Since the whole point is that one slot behaves identically to before, the one-mark case
  // returns p itself rather than a value that merely rounds to it.
  if (ps.length === 0) return 0;
  if (ps.length === 1) return ps[0];
  let miss = 1;
  for (const p of ps) miss *= 1 - p;
  return 1 - miss;
}

/** The equipped mark's chance that a broken combo survives (0 when it has none). */
export function markComboKeep(markId) {
  // COMBINED AS INDEPENDENT ROLLS: 1 - prod(1 - p). Two 30% chances are 51%, not 60% — adding
  // them would let three slots exceed certainty. With a single mark this reduces exactly to p, so
  // one slot is unchanged. (Today only one mark carries each of these two effects, so the stack
  // is unreachable in practice; it is written correctly anyway rather than left to be discovered.)
  const ids = markId !== undefined ? (markId == null ? [] : [markId]) : getEquippedMarks();
  const ps = [];
  for (const id of ids) {
    const m = markById(id);
    if (m && m.effect && m.effect.comboKeep) ps.push(m.effect.comboKeep);
  }
  // RETURN THE SINGLE VALUE UNTOUCHED. `1 - (1 - 0.3)` is 0.30000000000000004, not 0.3 — the
  // general formula does NOT reduce exactly to p in floating point, and the existing test caught
  // it. Since the whole point is that one slot behaves identically to before, the one-mark case
  // returns p itself rather than a value that merely rounds to it.
  if (ps.length === 0) return 0;
  if (ps.length === 1) return ps[0];
  let miss = 1;
  for (const p of ps) miss *= 1 - p;
  return 1 - miss;
}
