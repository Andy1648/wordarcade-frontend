// challenge.js — the WORD RACE CHALLENGE LINK (extension f, claude/specs/challenge-link.md, v1).
//
// A finished racer sends `/race/play?vs=<name>&t=<ms>&n=<words>`; the friend who opens it lands in
// the EXISTING race quick match (App.jsx LAUNCH_INTENT -> handleRaceQuickMatch) with a HUD chip
// "BEAT XAVI: 41.2s" and, at the end, a verdict line + SEND IT BACK.
//
// Pure helpers (build / parse / clamp / verdict) + a tiny sessionStorage stash. No ghost lane, no
// backend change, NO ECONOMY: the target is display only — never a racer, never in standings, never
// a winnerId and never a rival for the winner bonus.
//
// Lifetime: captured from the URL ONCE at boot (routerBoot.js — the app canonicalises the address
// bar to '/' right after mount, so a later read would find nothing), held in sessionStorage
// `taw.challenge`, cleared when the race it was opened for ends. A tab close drops it too.

import { isNameBlocked } from '../leaderboard/nameFilter.js';

export const CHALLENGE_KEY = 'taw.challenge';
export const CHALLENGE_PATH = '/race/play';
export const T_MIN = 5000;
export const T_MAX = 600000;
export const N_MIN = 5;
export const N_MAX = 100;
export const NAME_MAX = 16;
export const FALLBACK_NAME = 'A FRIEND';

function clampInt(raw, lo, hi) {
  const v = Math.round(Number(raw));
  if (!Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

/**
 * The shape a name may take in a link: letters, digits, _ and space, upper-cased, ≤16. A name the
 * leaderboard filter blocks (the same rule the DB enforces on usernames) reads as '' (-> A FRIEND).
 */
export function cleanName(raw) {
  const s = String(raw == null ? '' : raw)
    .replace(/[^A-Za-z0-9_ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim()
    .toUpperCase();
  return s && !isNameBlocked(s) ? s : '';
}

/** Clamp t (ms) to 5–600 s and n (words) to 5–100. Null when either is not a number at all. */
export function clampChallenge({ vs, t, n } = {}) {
  const tt = clampInt(t, T_MIN, T_MAX);
  const nn = clampInt(n, N_MIN, N_MAX);
  if (tt == null || nn == null) return null;
  return { vs: cleanName(vs) || FALLBACK_NAME, t: tt, n: nn };
}

/** Parse a query string (with or without '?') into a clamped challenge, or null. */
export function parseChallenge(search) {
  try {
    const p = new URLSearchParams(search || '');
    if (!p.has('t') || !p.has('n')) return null;
    if (p.get('t') === '' || p.get('n') === '') return null;
    return clampChallenge({ vs: p.get('vs'), t: p.get('t'), n: p.get('n') });
  } catch {
    return null;
  }
}

/** The link a sender shares. `origin` defaults to the live page's. Three params, < 80 chars. */
export function buildChallengeUrl({ vs, t, n }, origin) {
  const c = clampChallenge({ vs, t, n });
  if (!c) return null;
  let base = origin;
  if (base == null) {
    try {
      base = window.location.origin;
    } catch {
      base = 'https://typeaword.com';
    }
  }
  const q = `vs=${encodeURIComponent(c.vs)}&t=${c.t}&n=${c.n}`;
  return `${base}${CHALLENGE_PATH}?${q}`;
}

/** 41200 -> "41.2" (0.1 s precision, always one decimal). */
export function secText(ms) {
  const v = Math.round((Number(ms) || 0) / 100) / 10;
  return v.toFixed(1);
}

/** The sender's result, from MY standing in race_over (server-authoritative reachedAt = ms after go). */
export function senderResult(standing) {
  if (!standing) return null;
  const n = Number(standing.words);
  const t = Number(standing.reachedAt);
  if (!Number.isFinite(n) || n < N_MIN || n > N_MAX) return null;
  if (!Number.isFinite(t) || t <= 0) return null;
  return { n, t: clampInt(t, T_MIN, T_MAX) };
}

/** HUD chip copy. Same target: "BEAT XAVI: 41.2s"; a different one: "BEAT XAVI: 25 WORDS IN 41.2s". */
export function chipText(challenge, target, fmt = String) {
  if (!challenge) return '';
  const time = `${secText(challenge.t)}s`;
  if (challenge.n === target) return `BEAT ${challenge.vs}: ${time}`;
  return `BEAT ${challenge.vs}: ${fmt(challenge.n)} WORDS IN ${time}`;
}

/**
 * The end-of-race verdict. Same target AND I finished it: a straight time diff
 * ("YOU BEAT XAVI BY 3.2s" / "XAVI WINS BY 1.1s"). Otherwise compare words per second
 * ("YOU WERE FASTER" / "XAVI WAS FASTER"). `mine` = { words, ms } (ms after go).
 */
export function challengeVerdict(challenge, mine, target) {
  if (!challenge) return null;
  const vs = challenge.vs;
  const words = Number(mine?.words) || 0;
  const ms = Number(mine?.ms) || 0;
  if (challenge.n === target && words >= target && ms > 0) {
    const diff = challenge.t - ms;
    if (diff > 0) return { win: true, text: `YOU BEAT ${vs} BY ${secText(diff)}s` };
    if (diff < 0) return { win: false, text: `${vs} WINS BY ${secText(-diff)}s` };
    return { win: false, text: `DEAD HEAT WITH ${vs}` };
  }
  const theirs = challenge.n / challenge.t;
  const myRate = words > 0 && ms > 0 ? words / ms : 0;
  return myRate > theirs
    ? { win: true, text: 'YOU WERE FASTER' }
    : { win: false, text: `${vs} WAS FASTER` };
}

/** The spoiler-free share text (no words, just the numbers). */
export function shareText({ n, t }, fmt = String) {
  return `TYPE A WORD · RACE · ${fmt(n)} WORDS IN ${secText(t)}s · BEAT ME →`;
}

// ---- sessionStorage stash (every access guarded: blocked storage just means "no challenge") ----

export function saveChallenge(c, store) {
  try {
    const s = store || globalThis.sessionStorage;
    if (!s || !c) return false;
    s.setItem(CHALLENGE_KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

/** Read + RE-FILTER (a stored value is as untrusted as the URL it came from). */
export function readChallenge(store) {
  try {
    const s = store || globalThis.sessionStorage;
    if (!s) return null;
    const raw = JSON.parse(s.getItem(CHALLENGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    const c = clampChallenge(raw);
    return c ? { ...c, opened: !!raw.opened } : null;
  } catch {
    return null;
  }
}

export function clearChallenge(store) {
  try {
    const s = store || globalThis.sessionStorage;
    if (s) s.removeItem(CHALLENGE_KEY);
  } catch {
    /* storage blocked */
  }
}

/**
 * Boot capture (routerBoot.js, after the path bridge): a `/race/play` link bridges to
 * `?race=1&play=race&vs=…`; stash vs/t/n before the app tidies the URL. Anything else is ignored.
 */
export function captureChallengeFromUrl(search, store) {
  try {
    const q = search != null ? search : globalThis.location ? globalThis.location.search : '';
    const p = new URLSearchParams(q || '');
    if (p.get('play') !== 'race') return null;
    const c = parseChallenge(q);
    if (!c) return null;
    saveChallenge(c, store);
    return c;
  } catch {
    return null;
  }
}
