// src/share/shareText.js
// Builds the copyable, paste-into-the-group-chat share text: a Wordle-style
// emoji grid + a stat line + the "type fast. die slow." sign-off and a link.
//
// PURE module: no DOM, no imports beyond shareConfig (also pure), so it runs
// under `node --test` as-is. Spoiler-safe by construction — it never includes a
// category name or a secret word.
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
// A whiffed (0-point) round. A colored emoji, NOT a themed black/white square:
// '▪️' (U+25AA VS16) renders near-invisible on dark chat backgrounds, so a zero
// round vanished. Red reads as "got nothing that round" and survives light AND
// dark bubbles, on-brand for "die slow".
const CB_ZERO = '🟥';
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

// SAT Rush ante grid: one glyph per word — 🟨 answered fast (high ante), 🟪 a
// normal clear, 🟥 a miss. Middle-ellipsized past the cap so a long run stays on
// one chat line (keeps the start AND the dramatic ending).
const SR_MAX_GLYPHS = 16;
export function satRushGrid(log) {
  if (!Array.isArray(log) || !log.length) return null;
  const glyphs = log.map((e) => (!e.ok ? '🟥' : e.stage != null && e.stage <= 1 ? '🟨' : '🟪'));
  let row = glyphs;
  if (row.length > SR_MAX_GLYPHS) {
    row = [...row.slice(0, 6), '…', ...row.slice(row.length - (SR_MAX_GLYPHS - 7))];
  }
  return row.join('');
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
 *   mode    - 'word-bomb' | 'category-blitz' | 'sat-rush'
 *   outcome - word-bomb {won}; blitz {solo, isRecord, place, total}
 *   data    - word-bomb {words, longest, events:[{t:'word',len}|{t:'life'}]}
 *             blitz {score, roundScores:[...]}; sat-rush {cleared, avgAnte, ...}
 *   daily   - {dayNumber} for the Daily Challenge (blitz solo), else null
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
        data.wpm ? `${data.wpm} WPM ⌨️` : null,
        data.players ? `${data.players} player${data.players === 1 ? '' : 's'}` : null,
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
    // (Daily streak removed from the share copy — the streak feature is gone.)
    lines.push(
      statSuffix([
        score === 0 ? '0 PTS. brain fully buffered' : `${score} PTS`,
        outcome.isRecord ? 'NEW RECORD!' : null,
        data.wpm ? `${data.wpm} WPM ⌨️` : null,
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
        score === 0 ? '0 PTS. did you even try?' : `${score} PTS`,
        data.wpm ? `${data.wpm} WPM ⌨️` : null,
      ])
    );
  } else if (mode === 'sat-rush') {
    lines.push('TYPE A WORD · SAT RUSH 🧠');
    const grid = satRushGrid(data.runLog);
    if (grid) lines.push(grid);
    const words = Math.max(0, Number(data.cleared) || 0);
    // avg ante is the flex, so it LEADS the stats (ahead of streak) and, when
    // present, seeds a challenge CTA that turns the receipt into a dare. anteStr
    // is computed once so the stat fragment and the CTA always show the same value.
    const anteStr = data.avgAnte != null ? Number(data.avgAnte).toFixed(1) : null;
    lines.push(
      statSuffix([
        words === 0 ? '0 words. brutal' : `${words} word${words === 1 ? '' : 's'}`,
        anteStr != null ? `${anteStr}× avg ante` : null,
        data.wpm ? `${data.wpm} WPM ⌨️` : null,
        data.bestStreak ? `streak ${data.bestStreak}` : null,
      ])
    );
    if (data.hardest) lines.push(`hardest clear: ${String(data.hardest).toLowerCase()}`);
    if (anteStr != null) lines.push(`beat my ${anteStr}× avg ante 👀`);
  } else {
    lines.push('TYPE A WORD ⚡');
    lines.push('a word game where you type fast or die slow');
  }

  lines.push(SIGN_OFF);
  lines.push(url);
  return lines.join('\n');
}
