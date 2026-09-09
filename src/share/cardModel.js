// src/share/cardModel.js
// Normalizes each mode's EXISTING result data into a single spoiler-free card
// model { badge, neon, mascotSrc, hero, sub, chips, copy }. Pure: reads the
// passed fields, invents nothing, and NEVER includes a secret word or anything
// that ruins a round.
//
// `copy` (the text used by SHARE and COPY) is the Wordle-style emoji-grid text
// from shareText.js; `daily` / `link` pass straight through to it.

import { SHARE } from './shareConfig';
import { buildShareText } from './shareText.js';
import { buildRunResultText, runGlyph, RUN_GLYPH, HAND_MAX } from './runResult.js';

function modeTokens(mode) {
  return SHARE.modes[mode] || SHARE.defaultMode;
}

// A chip is dropped entirely if its value is missing (don't invent data).
function chip(label, value) {
  return value === undefined || value === null || value === '' ? null : { label, value: String(value) };
}

const ordinal = (n) => {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function buildCardModel({ mode, outcome = {}, data = {}, daily = null, link = null }) {
  const t = modeTokens(mode);
  let hero = '';
  let sub = '';
  let chips = [];
  let icons = [];
  let win = true;
  // THE RUN's extras (fix/hierarchy): the BANKED number is the hero (yellow), one glyph per
  // round, and the hand as a text line. Empty / '' for every other mode.
  let heroStyle = 'default';
  let glyphs = [];
  let handLine = '';

  if (mode === 'word-bomb') {
    win = !!outcome.won;
    hero = win ? 'SURVIVED' : 'ELIMINATED';
    sub = data.words != null ? `${data.words} WORDS` : '';
    chips = [chip('LONGEST', data.longest), chip('BEST STREAK', data.combo), chip('PLAYERS', data.players)];
  } else if (mode === 'category-blitz' && outcome.solo) {
    win = true;
    hero = String(data.score ?? 0);
    // Daily runs brand the card with the day number (and streak as a chip);
    // NEW RECORD! keeps top billing when both apply.
    sub = outcome.isRecord ? 'NEW RECORD!' : daily ? `DAILY #${daily.dayNumber}` : 'YOUR SCORE';
    chips = daily
      ? [
          chip('DAILY', `#${daily.dayNumber}`),
          chip('STREAK', daily.streak > 0 ? `${daily.streak} 🔥` : null),
          chip('BEST ROUND', data.bestRound),
        ]
      : [chip('ROUNDS', data.rounds), chip('BEST ROUND', data.bestRound)];
  } else if (mode === 'category-blitz') {
    win = outcome.place === 1;
    hero = outcome.place ? ordinal(outcome.place) : 'PLAYED';
    sub = outcome.total ? `OF ${outcome.total}` : '';
    chips = [chip('SCORE', data.score), chip('PLAYERS', outcome.total)];
  } else if (mode === 'sat-rush') {
    // Solo endless vocab run. Avg ante (mean base multiplier at clear) is the
    // headline stat — how fast you knew them — so it's the big hero number; the
    // hardest word cleared lives in the share TEXT (arbitrary-length words don't
    // fit the fixed image chips/sub).
    win = true;
    const ante = data.avgAnte != null ? `${Number(data.avgAnte).toFixed(1)}×` : '—';
    hero = ante;
    sub = 'AVG ANTE';
    chips = [chip('CLEARED', data.cleared), chip('STREAK', data.bestStreak), chip('SCORE', data.score)];
  } else if (mode === 'run') {
    // THE RUN (fix/hierarchy): lead with BANKED (the yellow hero number), "BANKED · ROUND n OF 10"
    // under it, the glyph row, then "HAND · A · B". No chips, no icons.
    win = outcome.reason === 'cleared';
    const reached = data.roundReached ?? 0;
    hero = Number(data.banked || 0).toLocaleString('en-US');
    heroStyle = 'banked';
    sub = `BANKED · ROUND ${reached} OF ${data.totalRounds ?? 10}`;
    chips = [];
    icons = [];
    const kind = (g) => (g === RUN_GLYPH.clear ? 'clear' : g === RUN_GLYPH.squeak ? 'squeak' : 'dead');
    glyphs = (Array.isArray(data.history) ? data.history : []).map((r) => kind(runGlyph(r)));
    const names = (Array.isArray(data.hand) ? data.hand : []).filter(Boolean).slice(0, HAND_MAX).map((n) => String(n).toUpperCase());
    handLine = names.length ? `HAND · ${names.join(' · ')}` : '';
  } else {
    hero = 'NOT BAD';
  }

  return {
    badge: daily ? 'DAILY CHALLENGE' : t.badge,
    neon: t.neon,
    mascotSrc: win ? t.mascot : t.mascotLoss,
    hero,
    sub,
    chips: chips.filter(Boolean).slice(0, 3),
    icons,
    heroStyle, // 'banked' → yellow outlined hero (THE RUN); 'default' → white with the neon glow
    glyphs,    // THE RUN: 'clear' | 'squeak' | 'dead' per round, else []
    handLine,  // THE RUN: "HAND · A · B", else ''
    copy: mode === 'run'
      ? buildRunResultText({ history: data.history, totalRounds: data.totalRounds, banked: data.banked, hand: data.hand, link })
      : buildShareText({ mode, outcome, data, daily, link }),
    link,
  };
}
