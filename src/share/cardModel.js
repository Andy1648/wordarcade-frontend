// src/share/cardModel.js
// Normalizes each mode's EXISTING result data into a single spoiler-free card
// model { badge, neon, mascotSrc, hero, sub, chips, copy }. Pure: reads the
// passed fields, invents nothing, and NEVER includes a secret word or anything
// that ruins a round (Imposter shows the verdict + role, never the word).

import { SHARE, REF_URL } from './shareConfig';

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

export function buildCardModel({ mode, outcome = {}, data = {} }) {
  const t = modeTokens(mode);
  let hero = '';
  let sub = '';
  let chips = [];
  let win = true;
  let copy = '';

  if (mode === 'word-bomb') {
    win = !!outcome.won;
    hero = win ? 'SURVIVED' : 'ELIMINATED';
    sub = data.words != null ? `${data.words} WORDS` : '';
    chips = [chip('LONGEST', data.longest), chip('BEST COMBO', data.combo), chip('PLAYERS', data.players)];
    copy = `I ${win ? 'SURVIVED' : 'got bombed in'} Word Bomb on TYPE A WORD 💣${
      data.words != null ? ` — ${data.words} words` : ''
    }${data.longest ? `, longest ${data.longest}` : ''}.`;
  } else if (mode === 'category-blitz' && outcome.solo) {
    win = true;
    hero = String(data.score ?? 0);
    sub = outcome.isRecord ? 'NEW RECORD!' : 'YOUR SCORE';
    chips = [chip('ROUNDS', data.rounds), chip('BEST ROUND', data.bestRound)];
    copy = `I scored ${data.score ?? 0} in AI Category Blitz on TYPE A WORD 🔥${
      outcome.isRecord ? ' (NEW RECORD!)' : ''
    }.`;
  } else if (mode === 'category-blitz') {
    win = outcome.place === 1;
    hero = outcome.place ? ordinal(outcome.place) : 'PLAYED';
    sub = outcome.total ? `OF ${outcome.total}` : '';
    chips = [chip('SCORE', data.score), chip('PLAYERS', outcome.total)];
    copy = `I came ${outcome.place ? ordinal(outcome.place) : 'in'}${
      outcome.total ? ` of ${outcome.total}` : ''
    } in Category Blitz on TYPE A WORD 🔥${data.score != null ? ` — ${data.score} pts` : ''}.`;
  } else if (mode === 'imposter-word') {
    // SPOILER-FREE: the end screen is a 5-round AGGREGATE (the role rotates each
    // round), so the card brags the win + how many you CAUGHT / FOOLED across the
    // game — NEVER the secret word or who the imposter was.
    win = !!outcome.won;
    hero = win ? 'WINNER' : 'GAME OVER';
    sub = 'IMPOSTER WORD';
    chips = [chip('CAUGHT', data.caught), chip('FOOLED', data.fooled), chip('ROUNDS', data.rounds)];
    copy = `I ${win ? 'won' : 'played'} Imposter Word on TYPE A WORD 🕵️${
      data.caught != null ? ` — caught ${data.caught}` : ''
    }${data.fooled != null ? `, fooled ${data.fooled}` : ''}.`;
  } else {
    hero = 'NICE RUN';
    copy = 'Playing TYPE A WORD.';
  }

  return {
    badge: t.badge,
    neon: t.neon,
    mascotSrc: win ? t.mascot : t.mascotLoss,
    hero,
    sub,
    chips: chips.filter(Boolean).slice(0, 3),
    copy: `${copy} ${SHARE.hook === 'CAN YOU BEAT THIS?' ? 'Can you beat this?' : ''} ${REF_URL}`.replace(/\s+/g, ' ').trim(),
  };
}
