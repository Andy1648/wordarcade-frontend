// h4-sim.mjs — H4 "MULTIPLAYER WINNER PAYS A TON": is a won match clearly bigger than solo, and
// can it be farmed? Run: node claude/finetune/h4-sim.mjs
//
// Reads the LIVE code: winnerPayout / WINNER_MATCH (src/progress/payout.js) and the per-word rate
// wordWinsEstimate (src/progress/wins.js — the same "priced in words" rate the cards quote, a
// 5-letter COMMON word at T0/R0). So retuning the table in payout.js re-runs this sim unchanged.
//
// MODEL (wall-clock minutes, overhead included — queue fill, countdowns, intermissions):
//   per-word wins = wordWinsEstimate(mode, difficulty) × W_AVG (rarity × combo, same for every mode)
//   SOLO          = rate × words/min                              (CHAIN reference, FUSE, SAT shown)
//   MATCH (1v1)   = (my game total + winner bonus) / game minutes  for the winner;
//                   my game total / game minutes                    for the loser
//   THROUGHPUTS are reasoned from each mode's loop (claude/winsmin-sim.mjs + backend timings):
//     WB    2p chill ~4/6/8 words/min each (turns alternate, 15s timer, 3 lives), ~2.5 min game
//     BLITZ 3 rounds × 20s + countdowns + 2 intermissions ≈ 1.75 min, 8/15/24 answers a game
//     RACE  25-word sprint, 60s cap, + countdown ≈ 1.0 min from race_start, 12/20/25 words
//     CHAIN/FUSE ~6/9.3/13 words/min (engine-derived), SAT ~4/6/8 (paced reveal)
import { winnerPayout, WINNER_MATCH, WINNER_GATES, WINNER_FALLBACK } from '../../src/progress/payout.js';
import { wordWinsEstimate } from '../../src/progress/wins.js';

const W_AVG = 1.5; // mean rarity × combo weight per word — applied to EVERY mode, so it cancels in ratios
const SKILLS = ['novice', 'median', 'strong'];
const rate = (mode, diff) => wordWinsEstimate({ mode, difficulty: diff }) * W_AVG;
const SOLO_WPM = { chain: [6, 9.3, 13], fuse: [6, 9.3, 13], satRush: [4, 6, 8] };
const MATCH = {
  wordBomb: { minutes: 2.5, words: (s) => [4, 6, 8][s] * 2.5 },
  blitz: { minutes: 1.75, words: (s) => [8, 15, 24][s] },
  wordRace: { minutes: 1.0, words: (s) => [12, 20, 25][s] },
};
const r0 = (x) => Math.round(x);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function match(mode, mySkill, rivalSkill, diff = null) {
  const m = MATCH[mode];
  const myWords = m.words(mySkill);
  const rivalWords = mode === 'wordBomb' ? Math.max(0, myWords - 1) : m.words(rivalSkill); // WB: turns alternate
  const total = myWords * rate(mode, diff);
  const p = winnerPayout({ mode, iWon: true, gameTotal: total, myWords, minutes: m.minutes, rivals: [{ id: 'r', words: rivalWords, isBot: false }] });
  return { winPerMin: (total + p.wins) / m.minutes, losePerMin: total / m.minutes, p };
}

const out = [];
const log = (s = '') => out.push(s);
log(`H4 sim — table: ${JSON.stringify(WINNER_MATCH)} gates: ${JSON.stringify(WINNER_GATES)} fallback: ${JSON.stringify(WINNER_FALLBACK)}`);
log(`per-word rate (T0/R0, 5 letters) × W_AVG ${W_AVG}: WB ${rate('wordBomb')} · Blitz ${rate('blitz')} · Race ${rate('wordRace')} · CHAIN ${rate('chain')} · FUSE ${rate('fuse')} · SAT ${rate('satRush')}`);
log('');
log('1) HONEST PLAY — wins per minute (chill / no difficulty)');
log(`${pad('skill', 8)}|${lpad('CHAIN', 7)}${lpad('FUSE', 7)}${lpad('SAT', 7)} |${lpad('WB win', 8)}${lpad('lose', 6)}${lpad('xCH', 6)} |${lpad('BZ win', 8)}${lpad('lose', 6)}${lpad('xCH', 6)} |${lpad('RC win', 8)}${lpad('lose', 6)}${lpad('xCH', 6)}`);
for (let s = 0; s < 3; s++) {
  const solo = (k) => rate(k) * SOLO_WPM[k][s];
  const ch = solo('chain');
  const row = [pad(SKILLS[s], 8), '|', lpad(r0(ch), 7), lpad(r0(solo('fuse')), 7), lpad(r0(solo('satRush')), 7), ' |'];
  for (const mode of ['wordBomb', 'blitz', 'wordRace']) {
    const x = match(mode, s, s);
    row.push(lpad(r0(x.winPerMin), 8), lpad(r0(x.losePerMin), 6), lpad((x.winPerMin / ch).toFixed(1), 6), ' |');
  }
  log(row.join(''));
}
log('   xCH = a won match per minute ÷ solo CHAIN per minute at the same skill. A 50/50 1v1 averages (win+lose)/2.');
log('');
log('2) STRONG beats NOVICE (contest cap check: a real lopsided win must not be capped)');
for (const mode of ['wordBomb', 'blitz', 'wordRace']) {
  const x = match(mode, 2, 0);
  log(`   ${pad(mode, 9)} bonus ×${x.p.mult.toFixed(2)} capped=${x.p.capped}`);
}
log('');

// 3) FARMS. Each returns wins/min to the farmer's wallet, compared to honest solo CHAIN (median)
// and to an honest STRONG winner of the same mode.
log('3) FARM ATTEMPTS — wins/min to the farmer (vs CHAIN median, vs an honest strong winner)');
const chainMed = rate('chain') * SOLO_WPM.chain[1];
function farm(label, mode, { myWords, minutes, rivals, selfIds, diff = null }) {
  const total = myWords * rate(mode, diff);
  const p = winnerPayout({ mode, iWon: true, gameTotal: total, myWords, minutes, rivals, selfIds });
  const perMin = (total + p.wins) / minutes;
  const strong = match(mode, 2, 2, diff).winPerMin;
  log(`   ${pad(label, 46)} ${pad(p.tier + (p.reason ? ':' + p.reason : '') + (p.capped ? ':cap-' + p.capped : ''), 22)} ${lpad(r0(perMin), 6)}/min  ${lpad((perMin / chainMed).toFixed(2), 5)}x CHAIN  ${lpad((perMin / strong).toFixed(2), 5)}x strong-win`);
}
// WB AFK dummy, same browser: dummy times out 3 lives × 15s; I play ~6 words at 3s.
farm('WB  AFK dummy tab, SAME browser', 'wordBomb', { myWords: 6, minutes: (6 * 3 + 3 * 15) / 60, rivals: [{ id: 'd', words: 0 }], selfIds: ['d'] });
farm('WB  AFK dummy, 2nd profile, 0 words', 'wordBomb', { myWords: 6, minutes: (6 * 3 + 3 * 15) / 60, rivals: [{ id: 'd', words: 0 }] });
farm('WB  minimal dummy, 2nd profile, 3 words, chill', 'wordBomb', { myWords: 6, minutes: (6 * 3 + 3 * 4 + 3 * 15) / 60, rivals: [{ id: 'd', words: 3 }] });
farm('WB  minimal dummy, 2nd profile, 3 words, HELL', 'wordBomb', { diff: 'hard', myWords: 5, minutes: (5 * 3 + 3 * 3 + 2 * 7) / 60, rivals: [{ id: 'd', words: 3 }] });
farm('WB  full self-play, 2 profiles, 20 words/min', 'wordBomb', { myWords: 30, minutes: 3, rivals: [{ id: 'd', words: 29 }] });
farm('WB  2-word game', 'wordBomb', { myWords: 2, minutes: 0.3, rivals: [{ id: 'd', words: 3 }] });
farm('WB  bot room (vs-bot)', 'wordBomb', { myWords: 15, minutes: 2.5, rivals: [{ id: 'b', words: 14, isBot: true }] });
farm('BZ  AFK dummy, 2nd profile, 3 answers', 'blitz', { myWords: 24, minutes: 1.75, rivals: [{ id: 'd', words: 3 }] });
farm('BZ  dummy answers 12 (half of mine)', 'blitz', { myWords: 24, minutes: 1.75, rivals: [{ id: 'd', words: 12 }] });
farm('BZ  bot room', 'blitz', { myWords: 24, minutes: 1.75, rivals: [{ id: 'b', words: 10, isBot: true }] });
farm('RC  dummy types 3 then leaves (forfeit)', 'wordRace', { myWords: 25, minutes: 0.9, rivals: [{ id: 'd', words: 3, left: true }] });
farm('RC  dummy types 13, alternating tabs', 'wordRace', { myWords: 25, minutes: 1.6, rivals: [{ id: 'd', words: 13 }] });
farm('RC  queue filled with bots', 'wordRace', { myWords: 25, minutes: 0.9, rivals: [{ id: 'b', words: 20, isBot: true }, { id: 'c', words: 18, isBot: true }] });
farm('RC  2-word race', 'wordRace', { myWords: 2, minutes: 0.3, rivals: [{ id: 'd', words: 1 }] });
log('   RE-DELIVERED game_over / race_over: noteRoundBonus refuses a 2nd note per game -> pays once (unit-tested).');

console.log(out.join('\n'));
