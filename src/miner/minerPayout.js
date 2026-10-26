// minerPayout.js — MINER through the ONE wins/XP pipeline (progress/wins.js), on the BLITZ rails.
//
// MINER is the Blitz lists played for rarity, so an accepted answer banks exactly like a Blitz answer —
// mode 'blitz' (a WEIGHTED mode: the banked unit is the cumulative per-answer weight) — with the ORE as the
// rarity weight (DIRT ×1 · COAL ×2 · GOLD ×4 · DIAMOND ×8, capped by cappedWordMult like every weight).
// The same 3-answer gate applies (answers 1-2 bank nothing, answer 3 releases all three).
//
// Called once per ACCEPTED answer of MINE, from App's FIFO drain (each frame is processed exactly once
// there), with my accepted count and running weight BEFORE this answer.
import { awardWordXp, bankWordWins, bankWeight } from '../progress/wins.js';
import { cappedWordMult } from '../progress/xp.js';
import { ORES } from './config.js';

export function bankMinerAnswer({ answer, ore, prevWords, prevWeight }) {
  const word = String(answer || '').trim();
  const wordLength = word.length;
  const prevN = Number.isFinite(prevWords) ? Math.max(0, Math.floor(prevWords)) : 0;
  const prevW = Number.isFinite(prevWeight) ? prevWeight : prevN;
  const weight = cappedWordMult((ORES[ore] || ORES.dirt).weight, 1, 1);
  const nowWeight = prevW + bankWeight(weight, word);
  awardWordXp({ mode: 'category-blitz', difficulty: null, wordLength, weight, word });
  const wins = bankWordWins({
    mode: 'blitz',
    difficulty: null,
    wordLength,
    prevWords: prevN,
    nowWords: prevN + 1,
    prevWeight: prevW,
    nowWeight,
  });
  return { wins, nowWeight };
}
