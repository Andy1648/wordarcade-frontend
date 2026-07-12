// src/share/cardModel.js
// Normalizes each mode's EXISTING result data into a single spoiler-free card
// model { badge, neon, mascotSrc, hero, sub, chips, copy }. Pure: reads the
// passed fields, invents nothing, and NEVER includes a secret word or anything
// that ruins a round (Imposter shows the verdict + role, never the word).
//
// `copy` (the text used by SHARE and COPY) is the Wordle-style emoji-grid text
// from shareText.js; `daily` / `link` pass straight through to it.

import { SHARE } from './shareConfig';
import { buildShareText } from './shareText.js';

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
  let win = true;

  if (mode === 'word-bomb') {
    win = !!outcome.won;
    hero = win ? 'SURVIVED' : 'ELIMINATED';
    sub = data.words != null ? `${data.words} WORDS` : '';
    chips = [chip('LONGEST', data.longest), chip('BEST COMBO', data.combo), chip('PLAYERS', data.players)];
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
  } else if (mode === 'imposter-word') {
    // SPOILER-FREE: the end screen is a 5-round AGGREGATE (the role rotates each
    // round), so the card brags the win + how many you CAUGHT / FOOLED across the
    // game — NEVER the secret word or who the imposter was.
    win = !!outcome.won;
    hero = win ? 'WINNER' : 'GAME OVER';
    sub = 'IMPOSTER WORD';
    chips = [chip('CAUGHT', data.caught), chip('FOOLED', data.fooled), chip('ROUNDS', data.rounds)];
  } else {
    hero = 'NICE RUN';
  }

  return {
    badge: daily ? 'DAILY CHALLENGE' : t.badge,
    neon: t.neon,
    mascotSrc: win ? t.mascot : t.mascotLoss,
    hero,
    sub,
    chips: chips.filter(Boolean).slice(0, 3),
    copy: buildShareText({ mode, outcome, data, daily, link }),
    link,
  };
}
