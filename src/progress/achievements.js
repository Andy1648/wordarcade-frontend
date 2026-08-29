// achievements.js — named, discoverable goals (Job 7). ~30 achievements across volume, speed,
// vocabulary, progression, streaks, per-mode feats, and 5 SECRET ones. Each grants wins (× the live
// rebirth mult, so a late achievement stays meaningful). A grid screen shows locked entries as
// silhouettes with their hint; secrets show only "???" until earned.
//
// Pure catalog + guarded store. `checkAchievements()` snapshots the live progress once, grants any
// newly-satisfied achievement, and returns the newly-earned list for a toast. Never throws.
import { readWordCount } from '../wordCount.js';
import { getWinsLifetime, getRounds, grantWins } from './wins.js';
import { loadProgress, getRebirths, getKeyTier, rebirthMult } from './xp.js';
import { collectionSummary } from './collection.js';
import { masteryState, MASTERY_MODES } from './mastery.js';
import { getStreak } from './streak.js';
import { bestWpmOverall } from './wpm.js';
import { getWordSenseTier } from './wordSense.js';

export const ACHIEVEMENTS_KEY = 'taw.achievements';

// Build a single snapshot of everything the checks read (one pass over storage).
export function achievementSnapshot() {
  const words = (() => { try { return readWordCount().total || 0; } catch { return 0; } })();
  const prog = loadProgress();
  const coll = collectionSummary(0);
  const mastery = {};
  for (const m of MASTERY_MODES) mastery[m] = masteryState(m).level;
  const minMastery = Math.min(...MASTERY_MODES.map((m) => mastery[m]));
  return {
    words,
    winsLifetime: getWinsLifetime(),
    level: prog.level,
    rebirths: getRebirths(),
    distinct: coll.total,
    obscure: coll.byTier.OBSCURE || 0,
    streak: getStreak().count || 0,
    bestWpm: bestWpmOverall(),
    keyTier: getKeyTier(),
    wsTier: getWordSenseTier(),
    rounds: getRounds(),
    mastery,
    minMastery,
  };
}

// The catalog. `base` is the wins reward (before the rebirth scale). `secret` hides name + hint
// behind "???" until earned. `test(s)` reads the snapshot. Order = display order within a category.
export const ACHIEVEMENTS = [
  // ---- VOLUME ----
  { id: 'vol-1', cat: 'VOLUME', name: 'FIRST BLOOD', hint: 'Accept your first word.', base: 100, test: (s) => s.words >= 1 },
  { id: 'vol-100', cat: 'VOLUME', name: 'WARMING UP', hint: 'Accept 100 words.', base: 500, test: (s) => s.words >= 100 },
  { id: 'vol-1k', cat: 'VOLUME', name: 'WORDSMITH', hint: 'Accept 1,000 words.', base: 2000, test: (s) => s.words >= 1000 },
  { id: 'vol-10k', cat: 'VOLUME', name: 'KEYBOARD WARRIOR', hint: 'Accept 10,000 words.', base: 20000, test: (s) => s.words >= 10000 },
  { id: 'vol-50k', cat: 'VOLUME', name: 'UNSTOPPABLE', hint: 'Accept 50,000 words.', base: 100000, test: (s) => s.words >= 50000 },
  // ---- SPEED ----
  { id: 'wpm-40', cat: 'SPEED', name: 'TOUCH TYPIST', hint: 'Hit 40 WPM in a measured mode.', base: 1000, test: (s) => s.bestWpm >= 40 },
  { id: 'wpm-70', cat: 'SPEED', name: 'FAST FINGERS', hint: 'Hit 70 WPM.', base: 3000, test: (s) => s.bestWpm >= 70 },
  { id: 'wpm-100', cat: 'SPEED', name: 'BLAZING', hint: 'Hit 100 WPM.', base: 10000, test: (s) => s.bestWpm >= 100 },
  // ---- VOCABULARY ----
  { id: 'obs-1', cat: 'VOCABULARY', name: 'DEEP CUT', hint: 'Find your first OBSCURE word.', base: 500, test: (s) => s.obscure >= 1 },
  { id: 'obs-50', cat: 'VOCABULARY', name: 'LEXICON', hint: 'Collect 50 OBSCURE words.', base: 10000, test: (s) => s.obscure >= 50 },
  { id: 'dist-500', cat: 'VOCABULARY', name: 'COLLECTOR', hint: 'Collect 500 distinct words.', base: 5000, test: (s) => s.distinct >= 500 },
  { id: 'dist-2500', cat: 'VOCABULARY', name: 'CURATOR', hint: 'Collect 2,500 distinct words.', base: 50000, test: (s) => s.distinct >= 2500 },
  // ---- PROGRESSION ----
  { id: 'lv-15', cat: 'PROGRESSION', name: 'ASCENDANT', hint: 'Reach level 15.', base: 1000, test: (s) => s.level >= 15 },
  { id: 'reb-1', cat: 'PROGRESSION', name: 'REBORN', hint: 'Rebirth for the first time.', base: 5000, test: (s) => s.rebirths >= 1 },
  { id: 'lv-50', cat: 'PROGRESSION', name: 'VETERAN', hint: 'Reach level 50.', base: 20000, test: (s) => s.level >= 50 },
  { id: 'reb-5', cat: 'PROGRESSION', name: 'PHOENIX', hint: 'Rebirth 5 times.', base: 50000, test: (s) => s.rebirths >= 5 },
  // ---- STREAKS ----
  { id: 'streak-3', cat: 'STREAKS', name: 'HABIT', hint: 'Play 3 days in a row.', base: 1000, test: (s) => s.streak >= 3 },
  { id: 'streak-7', cat: 'STREAKS', name: 'DEDICATED', hint: 'Play 7 days in a row.', base: 5000, test: (s) => s.streak >= 7 },
  { id: 'streak-30', cat: 'STREAKS', name: 'RITUAL', hint: 'Play 30 days in a row.', base: 50000, test: (s) => s.streak >= 30 },
  // ---- PER-MODE FEATS ----
  { id: 'm-wb-5', cat: 'MODES', name: 'BOMB SQUAD', hint: 'Reach Word Bomb Mastery 5.', base: 2000, test: (s) => s.mastery['word-bomb'] >= 5 },
  { id: 'm-blitz-5', cat: 'MODES', name: 'QUICK THINKER', hint: 'Reach Category Blitz Mastery 5.', base: 2000, test: (s) => s.mastery['category-blitz'] >= 5 },
  { id: 'm-sat-5', cat: 'MODES', name: 'SCHOLAR', hint: 'Reach SAT Rush Mastery 5.', base: 2000, test: (s) => s.mastery['sat-rush'] >= 5 },
  { id: 'm-chain-5', cat: 'MODES', name: 'UNBROKEN', hint: 'Reach CHAIN Mastery 5.', base: 2000, test: (s) => s.mastery['chain'] >= 5 },
  { id: 'm-fuse-5', cat: 'MODES', name: 'DEFUSER', hint: 'Reach FUSE Mastery 5.', base: 2000, test: (s) => s.mastery['fuse'] >= 5 },
  { id: 'm-all-3', cat: 'MODES', name: 'JACK OF ALL', hint: 'Reach Mastery 3 in every mode.', base: 10000, test: (s) => s.minMastery >= 3 },
  // ---- ECONOMY ----
  { id: 'kp-5', cat: 'ECONOMY', name: 'POWER USER', hint: 'Buy KEY POWER tier 5.', base: 10000, test: (s) => s.keyTier >= 5 },
  { id: 'ws-3', cat: 'ECONOMY', name: 'SIXTH SENSE', hint: 'Buy WORD SENSE tier 3.', base: 10000, test: (s) => s.wsTier >= 3 },
  // ---- SECRETS (hidden until earned) ----
  { id: 'sec-millionaire', cat: 'SECRET', name: 'PAPER CHASE', hint: 'Earn 1,000,000 wins all-time.', base: 20000, secret: true, test: (s) => s.winsLifetime >= 1000000 },
  { id: 'sec-dict', cat: 'SECRET', name: 'WALKING DICTIONARY', hint: 'Collect 100 OBSCURE words.', base: 25000, secret: true, test: (s) => s.obscure >= 100 },
  { id: 'sec-eternal', cat: 'SECRET', name: 'ETERNAL', hint: 'Rebirth 10 times.', base: 100000, secret: true, test: (s) => s.rebirths >= 10 },
  { id: 'sec-truemaster', cat: 'SECRET', name: 'TRUE MASTER', hint: 'Reach Mastery 10 in every mode.', base: 200000, secret: true, test: (s) => s.minMastery >= 10 },
  { id: 'sec-completionist', cat: 'SECRET', name: 'COMPLETIONIST', hint: 'Earn every other achievement.', base: 50000, secret: true, test: (s, earnedSet) => ACHIEVEMENTS.filter((a) => a.id !== 'sec-completionist').every((a) => earnedSet.has(a.id)) },
];

export function loadEarned() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw == null) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveEarned(ids) {
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked */
  }
}

export function isEarned(id) {
  return loadEarned().includes(id);
}

// Evaluate every un-earned achievement against a fresh snapshot; grant wins (× rebirth) for each
// newly satisfied one and persist. Returns the newly-earned achievement objects (with the granted
// wins) for a toast. Runs the completionist check LAST so it can see the others earned this pass.
export function checkAchievements() {
  // TEST-ONLY suppression of the on-load / on-home grant. Specs that seed progression (a high
  // level, lifetime wins, …) would otherwise get surprise achievement wins credited the moment the
  // menu mounts, corrupting a seeded wins balance. A spec opts out by setting the global BEFORE the
  // app boots (page.addInitScript). Guarded + window-only, so it is inert in production (no such
  // global is ever set) and in the Node unit tests (no `window`), which call this directly. It skips
  // this GRANT pass only — it never writes the earned set, so nothing is falsely marked earned.
  try {
    if (typeof window !== 'undefined' && window.__TAW_NO_ACHIEVEMENT_GRANT) return [];
  } catch {
    /* ignore — fall through to normal evaluation */
  }
  const snap = achievementSnapshot();
  const earned = new Set(loadEarned());
  const mult = rebirthMult(snap.rebirths);
  const newly = [];
  // Two passes so 'completionist' (which depends on the others) settles correctly.
  for (let pass = 0; pass < 2; pass++) {
    for (const a of ACHIEVEMENTS) {
      if (earned.has(a.id)) continue;
      let ok = false;
      try {
        ok = !!a.test(snap, earned);
      } catch {
        ok = false;
      }
      if (ok) {
        earned.add(a.id);
        const wins = Math.round(a.base * mult);
        grantWins(wins);
        newly.push({ ...a, wins });
      }
    }
  }
  if (newly.length) saveEarned([...earned]);
  return newly;
}

// For the grid screen: every achievement with its earned flag + display fields (secrets masked).
export function achievementList() {
  const earned = new Set(loadEarned());
  return ACHIEVEMENTS.map((a) => ({
    id: a.id,
    cat: a.cat,
    earned: earned.has(a.id),
    secret: !!a.secret,
    base: a.base,
    name: a.secret && !earned.has(a.id) ? '???' : a.name,
    hint: a.secret && !earned.has(a.id) ? 'A hidden achievement.' : a.hint,
  }));
}

export function achievementCounts() {
  const earned = loadEarned().length;
  return { earned, total: ACHIEVEMENTS.length };
}
