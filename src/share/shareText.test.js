// node --test src  — pure-logic tests for the share text builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, wordBombGrid, blitzRoundRow, SIGN_OFF } from './shareText.js';
import { REF_URL } from './shareConfig.js';

test('word bomb: win text has crown, no skull, counts words', () => {
  const txt = buildShareText({
    mode: 'word-bomb',
    outcome: { won: true },
    data: {
      words: 99, // whole-game total (card chip) — the grid events below must win
      longestWord: 'dinosaur',
      players: 4,
      events: [{ t: 'word', len: 5 }, { t: 'word', len: 9 }, { t: 'life' }, { t: 'word', len: 4 }],
    },
  });
  const lines = txt.split('\n');
  assert.equal(lines[0], 'TYPE A WORD · WORD BOMB 💣');
  assert.equal(lines[1], '⚡🔥💥⚡👑');
  assert.match(lines[2], /SURVIVED/);
  assert.match(lines[2], /3 words/); // 3 word events, not the 99 whole-game total
  assert.match(lines[2], /longest: DINOSAUR/);
  assert.match(lines[2], /4 players/);
  assert.equal(lines[3], SIGN_OFF);
  assert.equal(lines[4], REF_URL);
});

test('word bomb: loss ends the grid with a skull', () => {
  const txt = buildShareText({
    mode: 'word-bomb',
    outcome: { won: false },
    data: { events: [{ t: 'word', len: 4 }, { t: 'life' }] },
  });
  assert.equal(txt.split('\n')[1], '⚡💥☠️');
});

test('word bomb: 0-word game still shareable (no empty grid line)', () => {
  const txt = buildShareText({ mode: 'word-bomb', outcome: { won: false }, data: { words: 0, events: [] } });
  const lines = txt.split('\n');
  assert.equal(lines[1], '☠️'); // grid = just the elimination
  assert.match(lines[2], /0 words/);
  assert.doesNotMatch(txt, /undefined|null|NaN/);
});

test('word bomb: long games middle-ellipsize, keeping start and finish', () => {
  const events = Array.from({ length: 30 }, () => ({ t: 'word', len: 4 }));
  const grid = wordBombGrid(events, true);
  assert.ok(grid.includes('…'));
  // 6 head + ellipsis + 9 tail + crown
  assert.equal(Array.from(grid).length, 17);
  assert.ok(grid.endsWith('👑'));
});

test('blitz rows: blocks match score, cap at 8, zero gets a dot', () => {
  assert.equal(blitzRoundRow(0, 3), 'R1 🟧🟧🟧 3');
  assert.equal(blitzRoundRow(1, 12), `R2 ${'🟧'.repeat(8)} 12`);
  assert.equal(blitzRoundRow(2, 0), 'R3 ▪️ 0');
});

test('solo blitz: rounds render as rows, record flagged', () => {
  const txt = buildShareText({
    mode: 'category-blitz',
    outcome: { solo: true, isRecord: true },
    data: { score: 15, roundScores: [7, 3, 5] },
  });
  const lines = txt.split('\n');
  assert.equal(lines[0], 'TYPE A WORD · CATEGORY BLITZ 🔥');
  assert.equal(lines[1], 'R1 🟧🟧🟧🟧🟧🟧🟧 7');
  assert.equal(lines[2], 'R2 🟧🟧🟧 3');
  assert.equal(lines[3], 'R3 🟧🟧🟧🟧🟧 5');
  assert.match(lines[4], /15 PTS/);
  assert.match(lines[4], /NEW RECORD!/);
});

test('daily: header has day number, stat line has streak, no category names', () => {
  const txt = buildShareText({
    mode: 'category-blitz',
    outcome: { solo: true },
    data: { score: 11, roundScores: [4, 4, 3] },
    daily: { dayNumber: 193, streak: 5 },
  });
  assert.match(txt, /DAILY #193 ⚡/);
  assert.match(txt, /🔥 5-day streak/);
});

test('daily: streak of 0 shows no streak fragment', () => {
  const txt = buildShareText({
    mode: 'category-blitz',
    outcome: { solo: true },
    data: { score: 2, roundScores: [2, 0, 0] },
    daily: { dayNumber: 1, streak: 0 },
  });
  assert.doesNotMatch(txt, /streak/);
});

test('0-point daily still reads like a share, not an error', () => {
  const txt = buildShareText({
    mode: 'category-blitz',
    outcome: { solo: true },
    data: { score: 0, roundScores: [0, 0, 0] },
    daily: { dayNumber: 42, streak: 1 },
  });
  const lines = txt.split('\n');
  assert.equal(lines[1], 'R1 ▪️ 0');
  assert.match(txt, /0 PTS\. brain fully buffered/);
  assert.match(txt, /🔥 1-day streak/);
  assert.doesNotMatch(txt, /undefined|NaN/);
});

test('multiplayer blitz: place medal + custom invite link', () => {
  const txt = buildShareText({
    mode: 'category-blitz',
    outcome: { solo: false, place: 1, total: 4 },
    data: { score: 18 },
    link: 'https://typeaword.com/?join=ABCD&ref=share',
  });
  assert.match(txt, /🥇 1ST OF 4/);
  assert.ok(txt.endsWith('https://typeaword.com/?join=ABCD&ref=share'));
});

test('multiplayer blitz: 4th place gets ordinal, no medal', () => {
  const txt = buildShareText({
    mode: 'category-blitz',
    outcome: { solo: false, place: 4, total: 5 },
    data: { score: 1 },
  });
  assert.match(txt, /4TH OF 5/);
  assert.doesNotMatch(txt, /🥇|🥈|🥉/);
});

test('imposter: spoiler-free, caught/fooled rows, win crown', () => {
  const txt = buildShareText({
    mode: 'imposter-word',
    outcome: { won: true },
    data: { caught: 3, fooled: 2, rounds: 5 },
  });
  assert.match(txt, /caught ✅✅✅/);
  assert.match(txt, /fooled 🎭🎭/);
  assert.match(txt, /WINNER 👑/);
  assert.match(txt, /5 rounds/);
});

test('imposter: zero caught & fooled has a fun fallback line', () => {
  const txt = buildShareText({
    mode: 'imposter-word',
    outcome: { won: false },
    data: { caught: 0, fooled: 0, rounds: 5 },
  });
  assert.match(txt, /pure chaos/);
  assert.match(txt, /GAME OVER/);
});

test('every mode ends with sign-off then link', () => {
  for (const mode of ['word-bomb', 'category-blitz', 'imposter-word', 'unknown-mode']) {
    const lines = buildShareText({ mode }).split('\n');
    assert.equal(lines[lines.length - 2], SIGN_OFF, mode);
    assert.equal(lines[lines.length - 1], REF_URL, mode);
  }
});
