// racePayout.js — WORD RACE through the ONE wins/XP pipeline (progress/wins.js).
//
// PAYOUT HONESTY: a race word pays exactly what the WORD RACE card quotes — perWordRateNow({ mode:
// 'word-race' }) is the same perWordXp() product this banks, ÷10. No rarity, combo or lucky
// weighting (weight 1 every word), no difficulty (a race has none). The WINNER's bonus (H4) is paid
// once at race_over by App through progress/payout.js winnerPayout — not here, per word. The 3-word gate is the pipeline's own — words 1-2
// bank nothing and word 3 releases all three — so a race's TOTAL is still words × rate.
//
// Called once per ACCEPTED word of MINE, from App's FIFO drain (each frame is processed exactly
// once there), with my accepted count BEFORE this word.
import { awardWordXp, bankWordWins } from '../progress/wins.js';

export const RACE_PAYOUT_MODE = 'wordRace';

export function bankRaceWord({ word, prevWords }) {
  const wordLength = String(word || '').trim().length;
  const prev = Number.isFinite(prevWords) ? Math.max(0, Math.floor(prevWords)) : 0;
  const xp = awardWordXp({ mode: 'word-race', difficulty: null, wordLength, weight: 1 });
  const wins = bankWordWins({
    mode: RACE_PAYOUT_MODE,
    difficulty: null,
    wordLength,
    prevWords: prev,
    nowWords: prev + 1,
  });
  return { xp: xp.gain, wins, leveledUp: !!xp.leveledUp, level: xp.level };
}
