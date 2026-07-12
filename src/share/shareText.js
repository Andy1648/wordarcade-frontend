// src/share/shareText.js
// Builds the copyable, paste-into-the-group-chat share text: a Wordle-style
// emoji grid + a stat line + the "type fast. die slow." sign-off and a link.
//
// PURE module: no DOM, no imports beyond shareConfig (also pure), so it runs
// under `node --test` as-is. Spoiler-safe by construction — it never includes a
// category name, a secret word, or who the imposter was.
//
// Every mode's text follows the same shape so it reads as ONE brand in a chat:
//   TYPE A WORD · <MODE BADGE> <emoji>
//   <grid line(s)>
//   <stat line>
//   type fast. die slow.
//   <link>

import { REF_URL } from './shareConfig.js';

export const SIGN_OFF = 'type fast. die slow.';

// Word Bomb grid glyphs: one per event in MY game, in order.
const WB = {
  word: '⚡', // an accepted word
  bigWord: '🔥', // a long one (8+ letters)
  lifeLost: '💥',
  eliminated: '☠️',
  crown: '👑',
  empty: '💤', // played no words at all
};
const WB_BIG_WORD_LEN = 8;
const WB_MAX_GLYPHS = 16; // keep the grid one chat line; middle-ellipsize beyond

// Category Blitz round rows: one block per point, capped so a monster round
// doesn't wrap; the real number always follows the blocks.
const CB_BLOCK = '🟧';
const CB_ZERO = '▪️';
const CB_MAX_BLOCKS = 8;

const ORDINALS = ['', '1ST', '2ND', '3RD'];
function ordinal(n) {
  return ORDINALS[n] || `${n}TH`;
}
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * One emoji per Word Bomb event, middle-ellipsized past WB_MAX_GLYPHS so an
 * epic game still fits on a single chat line (keeps the start AND the ending —
 * the ending is where the drama is).
 */
export function wordBombGrid(events, won) {
  const glyphs = (events || []).map((e) => {
    if (e.t === 'word') return (e.len || 0) >= WB_BIG_WORD_LEN ? WB.bigWord : WB.word;
    if (e.t === 'life') return WB.lifeLost;
    return WB.word;
  });
  if (!won) glyphs.push(WB.eliminated);
  let row = glyphs;
  if (row.length > WB_MAX_GLYPHS) {
    const head = row.slice(0, 6);
    const tail = row.slice(row.length - (WB_MAX_GLYPHS - 7));
    row = [...head, '…', ...tail];
  }
  if (won) row.push(WB.crown);
  return row.length ? row.join('') : WB.empty;
}

/** "R1 🟧🟧🟧 3" — blocks capped, the real score always printed. */
export function blitzRoundRow(roundIndex, score) {
  const n = Math.max(0, Number(score) || 0);
  const blocks = n === 0 ? CB_ZERO : CB_BLOCK.repeat(Math.min(n, CB_MAX_BLOCKS));
  return `R${roundIndex + 1} ${blocks} ${n}`;
}

function statSuffix(parts) {
  return parts.filter(Boolean).join(' · ');
}

/**
 * The share text. Args mirror ShareBar's props:
 *   mode    - 'word-bomb' | 'category-blitz' | 'imposter-word'
 *   outcome - word-bomb {won}; blitz {solo, isRecord, place, total}; imposter {won}
 *   data    - word-bomb {words, longest, events:[{t:'word',len}|{t:'life'}]}
 *             blitz {score, roundScores:[...]}; imposter {caught, fooled, rounds}
 *   daily   - {dayNumber, streak} for the Daily Challenge (blitz solo), else null
 *   link    - URL for the last line (invite link for live rooms), default REF_URL
 */
export function buildShareText({ mode, outcome = {}, data = {}, daily = null, link } = {}) {
  const url = link || REF_URL;
  const lines = [];

  if (mode === 'word-bomb') {
    const won = !!outcome.won;
    lines.push('TYPE A WORD · WORD BOMB 💣');
    lines.push(wordBombGrid(data.events, won));
    // Prefer MY events (the grid's source) for the word count — `data.words` can
    // be the whole game's total (it also feeds the image card's chip).
    const words = data.events
      ? data.events.filter((e) => e.t === 'word').length
      : data.words ?? 0;
    lines.push(
      statSuffix([
        won ? 'SURVIVED' : 'ELIMINATED',
        words === 0 ? '0 words. blink and you die' : `${words} word${words === 1 ? '' : 's'}`,
        data.longestWord ? `longest: ${String(data.longestWord).toUpperCase()}` : null,
        data.players ? `${data.players} players` : null,
      ])
    );
  } else if (mode === 'category-blitz' && (outcome.solo || daily)) {
    const score = Math.max(0, Number(data.score) || 0);
    lines.push(
      daily
        ? `TYPE A WORD · DAILY #${daily.dayNumber} ⚡`
        : 'TYPE A WORD · CATEGORY BLITZ 🔥'
    );
    (data.roundScores || []).forEach((s, i) => lines.push(blitzRoundRow(i, s)));
    const streak = daily && daily.streak > 0 ? daily.streak : 0;
    lines.push(
      statSuffix([
        score === 0 ? '0 PTS. brain fully buffered' : `${score} PTS`,
        outcome.isRecord ? 'NEW RECORD!' : null,
        streak ? `🔥 ${streak}-day streak` : null,
      ])
    );
  } else if (mode === 'category-blitz') {
    const score = Math.max(0, Number(data.score) || 0);
    lines.push('TYPE A WORD · CATEGORY BLITZ 🔥');
    (data.roundScores || []).forEach((s, i) => lines.push(blitzRoundRow(i, s)));
    const medal = MEDALS[outcome.place] || '';
    lines.push(
      statSuffix([
        outcome.place
          ? `${medal ? `${medal} ` : ''}${ordinal(outcome.place)}${outcome.total ? ` OF ${outcome.total}` : ''}`
          : 'PLAYED',
        score === 0 ? '0 PTS. rough one' : `${score} PTS`,
      ])
    );
  } else if (mode === 'imposter-word') {
    const won = !!outcome.won;
    lines.push('TYPE A WORD · IMPOSTER WORD 🕵️');
    const caught = Math.max(0, Number(data.caught) || 0);
    const fooled = Math.max(0, Number(data.fooled) || 0);
    const row = statSuffix([
      caught ? `caught ${'✅'.repeat(Math.min(caught, 8))}` : null,
      fooled ? `fooled ${'🎭'.repeat(Math.min(fooled, 8))}` : null,
    ]);
    lines.push(row || 'nobody fooled. nobody caught. pure chaos 🎪');
    lines.push(
      statSuffix([won ? 'WINNER 👑' : 'GAME OVER', data.rounds ? `${data.rounds} rounds` : null])
    );
  } else {
    lines.push('TYPE A WORD ⚡');
    lines.push('a word game where you type fast or die slow');
  }

  lines.push(SIGN_OFF);
  lines.push(url);
  return lines.join('\n');
}
