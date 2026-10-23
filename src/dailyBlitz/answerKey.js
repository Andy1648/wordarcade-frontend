// dailyBlitz/answerKey.js — a VERBATIM port of the backend's Category Blitz matching key
// (chain-reaction-backend/blitzLists.js answerKey). DAILY BLITZ judges on the client against the
// same curated lists, so it must collapse answers exactly the way the server does: lowercase,
// accents stripped, "&" -> "and", a leading "the" dropped, every non-alphanumeric removed, and
// numbered names collapsed ("Henry VIII" == "henry 8" == "Henry the Eighth"). answerKey.test.js
// pins the server's own examples so the two can't drift. Pure: no DOM.

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
  'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth',
  'nineteenth', 'twentieth'];
const ROMAN = /^(x{0,3})(ix|iv|v?i{0,3})$/;

function romanToInt(t) {
  if (!t || !ROMAN.test(t)) return null;
  const v = { i: 1, v: 5, x: 10 };
  let n = 0;
  for (let i = 0; i < t.length; i++) {
    const a = v[t[i]];
    const b = v[t[i + 1]] || 0;
    n += a < b ? -a : a;
  }
  return n > 0 ? n : null;
}

function canonToken(tok, i) {
  const ord = ORDINAL.indexOf(tok);
  if (ord >= 0) return String(ord + 1);
  const m = /^(\d+)(st|nd|rd|th)$/.exec(tok);
  if (m) return m[1];
  if (i > 0) {
    const r = romanToInt(tok);
    if (r) return String(r);
  }
  return tok;
}

/** The server's matching key for a typed answer ('' for nothing usable). */
export function answerKey(s) {
  const words = String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words[0] === 'the') words.shift();
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    if (words[i] === 'the' && i > 0 && next && (ORDINAL.includes(next) || /^\d/.test(next))) continue;
    out.push(canonToken(words[i], out.length));
  }
  return out.join('');
}
