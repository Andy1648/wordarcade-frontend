// unified-xp-sim.mjs (Job 1) — pacing sim for the UNIFIED economy: every accepted word now grants
// XP, so playing levels you (fast lane) and menu typing still levels you (slow lane). Run:
//   node claude/unified-xp-sim.mjs
// Pure model reused from src/progress/xp.js so the sim can't drift from the shipped numbers.
import { need, xpPerInput, xpPerWord, XP_MULTIPLIERS } from '../src/progress/xp.js';

// Cumulative XP required to REACH a level from LV1 (sum of need(1..L-1)).
function cumXpTo(level) {
  let sum = 0;
  for (let n = 1; n < level; n++) sum += need(n);
  return sum;
}
// Level reached after spending `xp` cumulative XP from LV1.
function levelAfterXp(xp) {
  let level = 1, spent = 0;
  while (spent + need(level) <= xp) { spent += need(level); level += 1; }
  return level;
}

// ---- R0 / T0 assumptions (no upgrades) --------------------------------------------------
// keyTierXp(0)=10, rebirth ×1, streak ×1. A "typical" accepted word is 5 letters, COMMON (rarity
// weight ×1) — the conservative baseline; rarer words (esp. SAT's ~56%-OBSCURE deck) pay MORE, so
// real playing is faster than these figures, not slower.
const AVG_LEN = 5;
const AVG_WEIGHT = 1; // COMMON baseline
const MENU_XP_PER_KEY = xpPerInput({ mode: 'menu', keyTier: 0, rebirthCount: 0, streakMult: 1 });

const MODES = [
  ['word-bomb', 'WORD BOMB'],
  ['category-blitz', 'CATEGORY BLITZ'],
  ['sat-rush', 'SAT RUSH'],
  ['chain', 'CHAIN'],
  ['fuse', 'FUSE'],
];
const xpWord = (mode) => xpPerWord({ mode, keyTier: 0, rebirthCount: 0, streakMult: 1, wordLength: AVG_LEN, weight: AVG_WEIGHT });

console.log('=== UNIFIED XP PACING SIM (R0 / T0, no upgrades) ===\n');
console.log(`Menu XP per keystroke: ${MENU_XP_PER_KEY}  (a 5-letter word typed on the menu = ${MENU_XP_PER_KEY * AVG_LEN} XP)`);
console.log(`Per-word XP (5-letter COMMON word), by mode  [mode XP mult in brackets]:`);
for (const [id, name] of MODES) console.log(`  ${name.padEnd(16)} ×${XP_MULTIPLIERS[id]}  →  ${xpWord(id)} XP/word   (${(xpWord(id) / (MENU_XP_PER_KEY * AVG_LEN)).toFixed(1)}× the menu-typing of that word)`);

// ---- Levels-per-session (EQUAL EFFORT) --------------------------------------------------
// Fair comparison: the SAME typing effort — 60 words — spent on the menu vs spent playing. (Using
// equal effort, not equal wall-clock: at max keystroke rate the menu can mash more keys/min than a
// paced game, but that's boring mashing; the point of the reward is that ENGAGING with a word in a
// game pays 2–5× the menu value of that same word.) A session ≈ 60 accepted/typed words.
const PLAY_WORDS_PER_SESSION = 60;
const menuSessionXp = PLAY_WORDS_PER_SESSION * AVG_LEN * MENU_XP_PER_KEY; // 60 words × 5 letters
console.log(`\n=== LEVELS PER SESSION — 60 WORDS OF EFFORT (from LV1) ===`);
console.log(`MENU  (type 60 words = ${menuSessionXp} XP): reaches LV ${levelAfterXp(menuSessionXp)}  →  ${levelAfterXp(menuSessionXp) - 1} levels  [the slow lane]`);
for (const [id, name] of MODES) {
  const xp = PLAY_WORDS_PER_SESSION * xpWord(id);
  console.log(`PLAY  ${name.padEnd(16)} (60 words = ${xp} XP): reaches LV ${levelAfterXp(xp)}  →  ${levelAfterXp(xp) - 1} levels  (${(xp / menuSessionXp).toFixed(1)}× the menu)`);
}

// ---- Words / keystrokes to the gate levels ----------------------------------------------
const GATES = [[15, 'LV15 — first REBIRTH'], [20, 'LV20 — CHAIN unlock'], [25, 'LV25 — FUSE unlock']];
console.log(`\n=== EFFORT TO GATE LEVELS (R0/T0) ===`);
for (const [lvl, label] of GATES) {
  const cx = cumXpTo(lvl);
  console.log(`\n${label}  (cumulative ${cx.toLocaleString()} XP)`);
  console.log(`  MENU: ${Math.ceil(cx / MENU_XP_PER_KEY).toLocaleString()} keystrokes  (~${Math.ceil(cx / MENU_XP_PER_KEY / AVG_LEN).toLocaleString()} words)`);
  for (const [id, name] of MODES) {
    const w = Math.ceil(cx / xpWord(id));
    console.log(`  PLAY ${name.padEnd(16)}: ${w.toLocaleString()} accepted words  (~${(w / PLAY_WORDS_PER_SESSION).toFixed(1)} sessions)`);
  }
}

// ---- Trivial-rebirth check --------------------------------------------------------------
console.log(`\n=== REBIRTH TRIVIALITY CHECK ===`);
const cx15 = cumXpTo(15);
const fuseWordsTo15 = Math.ceil(cx15 / xpWord('fuse'));
const wbWordsTo15 = Math.ceil(cx15 / xpWord('word-bomb'));
console.log(`Fastest mode (FUSE): ${fuseWordsTo15} words to first rebirth (~${(fuseWordsTo15 / PLAY_WORDS_PER_SESSION).toFixed(1)} sessions).`);
console.log(`Slowest mode (WORD BOMB): ${wbWordsTo15} words (~${(wbWordsTo15 / PLAY_WORDS_PER_SESSION).toFixed(1)} sessions).`);
console.log(`Note: FUSE is LV25-gated, so a new player CANNOT use it for the first rebirth — they're on Word Bomb/Blitz/SAT.`);
const satWordsTo15 = Math.ceil(cx15 / xpWord('sat-rush'));
console.log(`Realistic first-rebirth path (Word Bomb/Blitz/SAT): ${wbWordsTo15}–${satWordsTo15} words.`);
