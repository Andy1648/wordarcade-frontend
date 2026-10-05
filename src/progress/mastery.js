// mastery.js — per-MODE MASTERY track (Job 2). Each mode levels 1..20 from the words you accept in
// THAT mode, giving a reason to commit to a mode beyond its raw payout. The perk is a per-mode XP
// BONUS (a DIFFERENT axis than the wins payout — deliberately not "more wins," which is the very
// thing that already differentiates modes): mastering a mode makes it level you faster, so it
// compounds the Job-1 unified loop (play → XP → levels) for the mode you invest in. Chosen over the
// spec's mechanical examples (+timer / +life / +reroll) because those touch each mode's SIMULATED
// balance — and Word Bomb / Blitz are server-authoritative, so a client perk can't change their
// timer/rerolls anyway. Mechanical perks are proposed in the Job-2 report for later opt-in.
//
// PURE + localStorage-backed, every access guarded (blocked store → M1 everywhere, never throws).
// Keyed by the menu/XP-style mode ids so it co-locates with awardWordXp (xp.js), which credits both.

export const MASTERY_KEY = 'taw.mastery';
// Menu/XP-style mode ids (the ones passed to awardWordXp) — one mastery track per playable mode.
export const MASTERY_MODES = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'];
// ECONOMY v9 (STEP 19 / Andy A6: "CHAIN and FUSE bars go MUCH higher with better rewards"): the bar
// runs to M50 (was M20) on a QUADRATIC per-level cost (was ×1.4 a level, whose late levels were 16 h+
// apart), and every 5th level pays a wins MILESTONE (wins.js awardWordXp → grantWins, so it shows).
// oct2 (Andy: "nothing caps at a dead end"): M50 is the headline GOAL, not a ceiling — the bar keeps
// going (same quadratic, a milestone every 5 levels) forever. MASTERY_HARD_CAP only bounds the loop.
export const MASTERY_MAX = 50;
export const MASTERY_HARD_CAP = 9999;
export const MASTERY_BASE = 30;
export const MASTERY_QUAD = 1.2;
export const MASTERY_MILESTONE_EVERY = 5;
export const MASTERY_MILESTONE_WORDS = 30; // every 5th mastery level pays 30 words' worth of this mode's wins (loop 1: flat — it compounded to 7 minutes of play by M15)
// The perk: +3% XP for that mode per mastery level above M1 (M1 = base, M50 = +147%).
export const MASTERY_XP_STEP = 0.03;

// Words to advance FROM `level` to level+1: round(30 + 1.2 × level²). M1→M2 = 31, M10→M11 = 150,
// M49→M50 = 2,911; M50 in ~50k words of one mode.
export function masteryNeed(level) {
  const l = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  return Math.round(MASTERY_BASE + MASTERY_QUAD * l * l);
}
/** Is `level` a milestone level (pays wins on reaching it)? */
export function isMasteryMilestone(level) {
  return Number.isFinite(level) && level > 1 && level % MASTERY_MILESTONE_EVERY === 0;
}

// Cumulative words to REACH a mastery level (M1 = 0). Pure helper for the pacing sim / dialog copy.
export function masteryWordsToReach(level) {
  const target = Number.isFinite(level) && level > 1 ? Math.min(MASTERY_HARD_CAP, Math.floor(level)) : 1;
  let sum = 0;
  for (let n = 1; n < target; n++) sum += masteryNeed(n);
  return sum;
}

// Derive {level, intoLevel, need, frac, maxed, words} from a cumulative word count. Uncapped past M50 (bounded only by MASTERY_HARD_CAP).
export function masteryFromWords(words) {
  const total = Number.isFinite(words) && words > 0 ? Math.floor(words) : 0;
  let level = 1;
  let spent = 0;
  while (level < MASTERY_HARD_CAP && total - spent >= masteryNeed(level)) {
    spent += masteryNeed(level);
    level += 1;
  }
  const maxed = level >= MASTERY_HARD_CAP;
  const need = maxed ? 0 : masteryNeed(level);
  const intoLevel = total - spent;
  return { level, intoLevel, need, frac: need > 0 ? intoLevel / need : 1, maxed, words: total };
}

function loadAll() {
  const out = {};
  for (const m of MASTERY_MODES) out[m] = 0;
  try {
    const raw = localStorage.getItem(MASTERY_KEY);
    if (raw == null) return out;
    const o = JSON.parse(raw) || {};
    for (const m of MASTERY_MODES) {
      const v = Number(o[m]);
      if (Number.isFinite(v) && v >= 0) out[m] = Math.floor(v);
    }
  } catch {
    /* fall through to zeroed */
  }
  return out;
}
function saveAll(all) {
  try {
    localStorage.setItem(MASTERY_KEY, JSON.stringify(all));
  } catch {
    /* storage blocked */
  }
}

// Raw cumulative words accepted in a mode.
export function masteryWords(mode) {
  return loadAll()[mode] || 0;
}
// The full mastery state for a mode.
export function masteryState(mode) {
  return masteryFromWords(masteryWords(mode));
}
// Every mode's state, for the menu/stats.
export function allMasteryStates() {
  const all = loadAll();
  const out = {};
  for (const m of MASTERY_MODES) out[m] = masteryFromWords(all[m]);
  return out;
}

// Credit one accepted word to a mode's mastery. Returns { level, leveledUp }. Unknown mode → no-op.
export function addMasteryWord(mode) {
  if (!MASTERY_MODES.includes(mode)) return { level: 1, leveledUp: false };
  const all = loadAll();
  const before = masteryFromWords(all[mode]).level;
  all[mode] = (all[mode] || 0) + 1;
  saveAll(all);
  const after = masteryFromWords(all[mode]).level;
  return { level: after, leveledUp: after > before };
}

// The per-mode XP multiplier from mastery: 1 at M1, +3%/level (×2.47 at M50, and it keeps climbing — linear, never a wall). Unknown mode → 1.
export function masteryXpMult(mode) {
  if (!MASTERY_MODES.includes(mode)) return 1;
  const lvl = masteryState(mode).level;
  return 1 + MASTERY_XP_STEP * (lvl - 1);
}

// The perk description for a mode's current level, for the dialog copy.
export function masteryPerkLabel(mode) {
  const pct = Math.round(MASTERY_XP_STEP * (masteryState(mode).level - 1) * 100);
  return pct > 0 ? `+${pct}% ${modeShortName(mode)} WINS` : `no bonus yet — reach M2`; // v11: mastery pays wins (BONUS), not level XP
}

function modeShortName(mode) {
  return { 'word-bomb': 'WORD BOMB', 'category-blitz': 'BLITZ', 'sat-rush': 'SAT RUSH', chain: 'CHAIN', fuse: 'FUSE' }[mode] || mode;
}
