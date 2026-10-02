// client.js — the leaderboard's data layer (STEP 24; Andy A13: username only, no sign-in).
//
// Talks to Supabase over plain fetch + PostgREST (no supabase-js: ~0 bytes of new dependency on the
// menu path). The URL + anon key come from Vite env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, set
// in Vercel for Production + Preview); with either missing, the feature is OFF and every call is a
// harmless no-op, so local dev and forks never break.
//
// IDENTITY: no accounts. The browser holds a random SECRET (localStorage taw.lb.secret); the DB
// stores only its SHA-256 and every write goes through a SECURITY DEFINER function that checks it
// (supabase/migrations/001_leaderboard.sql). Lose the secret (clear storage) and the name stays on
// the board, owned by nobody — exactly what a guest handle should do.
import { getRebirths } from '../progress/xp.js';
import { MASTERY_MODES, masteryWords } from '../progress/mastery.js';
import { perWordRateNow } from '../progress/wins.js';
import { getLetters } from '../progress/letters.js';

const RAW_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const BASE = RAW_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

// THE FLAG. On whenever the env is configured (Production + Preview); off otherwise.
export const LEADERBOARD_ENABLED = !!(BASE && KEY);

const SECRET_KEY = 'taw.lb.secret';
const PROFILE_KEY = 'taw.lb.profile';
export const BOARD_SIZE = 100;
const SUBMIT_EVERY_MS = 30 * 1000;

function headers() {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

async function rpc(fn, body) {
  const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    let code = (data && data.message) || `http_${r.status}`;
    // a same-name race that reached the unique index (older DB functions) is still "taken"
    if (data && (data.code === '23505' || /duplicate key/i.test(code))) code = 'username_taken';
    const err = new Error(code);
    err.code = code;
    throw err;
  }
  return data;
}

// ---- local identity --------------------------------------------------------------------------
export function getSecret() {
  try {
    let s = localStorage.getItem(SECRET_KEY);
    if (!s || s.length < 32) {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      s = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(SECRET_KEY, s);
      // Two tabs minting at once: whichever write landed LAST is the one every later call reads, so
      // re-read rather than trusting the value this tab generated.
      s = localStorage.getItem(SECRET_KEY) || s;
    }
    return s;
  } catch {
    return null; // storage blocked: the player can still READ the board, just not claim
  }
}

export function getMyProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    return p && typeof p.username === 'string' ? p : null;
  } catch {
    return null;
  }
}

function saveMyProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: p.id, username: p.username })); } catch { /* ignore */ }
}

// ---- what the board shows about me -----------------------------------------------------------
function readLevel() {
  try {
    const raw = JSON.parse(localStorage.getItem('taw.xp') || '{}');
    return Math.max(1, Math.floor(Number(raw.lv) || 1));
  } catch {
    return 1;
  }
}

/** The numbers this browser reports: level, rebirths, lifetime words + LETTERS (STEP 51), WINS/WORD. */
export function myStats() {
  let words = 0;
  for (const m of MASTERY_MODES) words += masteryWords(m) || 0;
  let wpw = 0;
  try { wpw = perWordRateNow({ mode: 'word-bomb' }).rate || 0; } catch { wpw = 0; }
  let letters = 0;
  try { letters = getLetters(); } catch { letters = 0; }
  return { level: readLevel(), rebirths: getRebirths() || 0, lifetimeWords: words, lifetimeLetters: letters, winsPerWord: Math.round(wpw * 10) / 10 };
}

// ---- what the DB can do (STEP 51) ------------------------------------------------------------
// supabase/migrations/005_letters_cjk.sql adds LETTERS + Chinese names and a lb_caps() probe. Until
// it is applied the probe 404s and everything below keeps the v1 behaviour (words, ASCII names).
let capsPromise = null;
export function boardCaps() {
  if (!LEADERBOARD_ENABLED) return Promise.resolve({ letters: false, cjk: false });
  if (!capsPromise) {
    capsPromise = rpc('lb_caps', {})
      .then((c) => ({ letters: !!(c && c.letters), cjk: !!(c && c.cjk) }))
      .catch(() => ({ letters: false, cjk: false }));
  }
  return capsPromise;
}

// ---- API -------------------------------------------------------------------------------------
/** 'ok' | 'shape' | 'blocked' | 'taken' — the server's verdict on a name (no secret needed). */
export async function nameStatus(username) {
  if (!LEADERBOARD_ENABLED) return 'ok';
  return rpc('lb_name_status', { p_username: username });
}

/** Claim (or rename to) `username`. Resolves to the profile; rejects with err.code in
 *  username_taken | username_blocked | username_shape | bad_secret | rate_limited | rename_cooldown
 *  | http_*. Pushes stats at once. */
export async function claimName(username) {
  const secret = getSecret();
  if (!LEADERBOARD_ENABLED || !secret) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  const row = await rpc('lb_claim', { p_secret: secret, p_username: username });
  saveMyProfile(row);
  lastSubmit = 0;
  const pushed = await submitStats(true);
  // Seed the rank-up baseline with where the claim landed — but only if my stats actually reached
  // the board: a failed push leaves the row at LV1 and would stage a fake "#57 → #3" later.
  if (pushed) {
    const rank = await fetchMyRank();
    if (rank) setLastRank(rank);
  }
  return row;
}

let lastSubmit = 0;
/** Push my stats if I have a name. Throttled to once per 30 s unless forced; never throws. */
export async function submitStats(force = false) {
  if (!LEADERBOARD_ENABLED || !getMyProfile()) return false;
  const now = Date.now();
  if (!force && now - lastSubmit < SUBMIT_EVERY_MS) return false;
  lastSubmit = now;
  const s = myStats();
  try {
    const caps = await boardCaps();
    if (caps.letters) {
      await rpc('lb_submit2', {
        p_secret: getSecret(),
        p_level: s.level,
        p_rebirths: s.rebirths,
        p_lifetime_words: s.lifetimeWords,
        p_lifetime_letters: s.lifetimeLetters,
        p_wins_per_word: s.winsPerWord,
      });
    } else {
      await rpc('lb_submit', {
        p_secret: getSecret(),
        p_level: s.level,
        p_rebirths: s.rebirths,
        p_lifetime_words: s.lifetimeWords,
        p_wins_per_word: s.winsPerWord,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** The top of the board + (if I have a name and I'm below it) my own row. */
export async function fetchBoard(limit = BOARD_SIZE) {
  if (!LEADERBOARD_ENABLED) return { rows: [], me: null };
  const caps = await boardCaps();
  const cols = `rank,id,username,level,rebirths,lifetime_words,${caps.letters ? 'lifetime_letters,' : ''}wins_per_word`;
  const r = await fetch(`${BASE}/rest/v1/leaderboard?select=${cols}&order=rank.asc&limit=${limit}`, { headers: headers() });
  if (!r.ok) throw Object.assign(new Error(`http_${r.status}`), { code: `http_${r.status}` });
  const rows = await r.json();
  const mine = getMyProfile();
  let me = null;
  if (mine && mine.id && !rows.some((x) => x.id === mine.id)) {
    const r2 = await fetch(`${BASE}/rest/v1/leaderboard?select=${cols}&id=eq.${encodeURIComponent(mine.id)}`, { headers: headers() });
    if (r2.ok) me = (await r2.json())[0] || null;
  }
  return { rows, me };
}

// ---- STEP 47: pulling players in -------------------------------------------------------------
// The board's order, as a comparator: rebirths desc, level desc, lifetime words desc. A HYPOTHETICAL
// row (someone not on the board yet) loses every exact tie — the existing row got there first, the
// same rule the view's created_at tiebreak applies.
export function ranksAhead(row, me) {
  // STEP 51: a board that carries LETTERS ranks by them first (letters, level, rebirths).
  if (row.lifetime_letters != null && me.lifetimeLetters != null) {
    const L = Number(row.lifetime_letters) || 0;
    if (L !== me.lifetimeLetters) return L > me.lifetimeLetters;
    const lv = Number(row.level) || 0;
    if (lv !== me.level) return lv > me.level;
    return (Number(row.rebirths) || 0) >= me.rebirths;
  }
  const r = Number(row.rebirths) || 0;
  const l = Number(row.level) || 0;
  const w = Number(row.lifetime_words) || 0;
  if (r !== me.rebirths) return r > me.rebirths;
  if (l !== me.level) return l > me.level;
  return w >= me.lifetimeWords;
}

/** The rank `stats` would take on a board whose top rows are `rows` (null if off the top-N). */
export function hypotheticalRank(rows, stats, size = BOARD_SIZE) {
  let ahead = 0;
  for (const row of rows) if (ranksAhead(row, stats)) ahead += 1;
  const rank = ahead + 1;
  return rank <= size ? rank : null;
}

const PROMPT_SESSION_KEY = 'taw.lb.promptShown'; // seen ON SCREEN this session
const PROMPT_CHECKED_KEY = 'taw.lb.promptChecked'; // the one board read this session already happened
const PROMPT_DISMISS_KEY = 'taw.lb.promptDismiss'; // { n, at } across sessions
const DISMISS_BACKOFF_MS = 7 * 24 * 3600 * 1000;
/** May the end-screen claim prompt run at all right now? (once per session; 3 ✕ → quiet for a week) */
export function claimPromptAllowed() {
  try {
    if (sessionStorage.getItem(PROMPT_SESSION_KEY) === '1') return false;
    if (sessionStorage.getItem(PROMPT_CHECKED_KEY) === '0') return false; // checked: off the board
    const d = JSON.parse(localStorage.getItem(PROMPT_DISMISS_KEY) || 'null');
    if (d && d.n >= 3 && Date.now() - d.at < DISMISS_BACKOFF_MS) return false;
    return true;
  } catch {
    return false; // no session storage → we can't keep "once per session", so never
  }
}
// The session's one board read, cached: the rank it found, or '0' for "not on the top N / failed".
function cachedPromptRank() {
  try { const v = sessionStorage.getItem(PROMPT_CHECKED_KEY); return v == null ? undefined : Number(v) || null; } catch { return null; }
}
function cachePromptRank(rank) {
  try { sessionStorage.setItem(PROMPT_CHECKED_KEY, String(rank || 0)); } catch { /* ignore */ }
}
export function markClaimPromptSeen() {
  try { sessionStorage.setItem(PROMPT_SESSION_KEY, '1'); } catch { /* ignore */ }
}
export function noteClaimPromptDismissed() {
  try {
    const d = JSON.parse(localStorage.getItem(PROMPT_DISMISS_KEY) || 'null') || { n: 0, at: 0 };
    const fresh = Date.now() - d.at >= DISMISS_BACKOFF_MS;
    localStorage.setItem(PROMPT_DISMISS_KEY, JSON.stringify({ n: (fresh && d.n >= 3 ? 0 : d.n) + 1, at: Date.now() }));
  } catch { /* ignore */ }
}

/** The rank this browser's stats would claim right now, or null (claimed already / off-board /
 *  offline). One board read; never throws. */
export async function rankIfClaimed() {
  if (!LEADERBOARD_ENABLED || getMyProfile()) return null;
  // ONE board read per session: a prompt that rendered below the fold and was never scrolled to can
  // come back on the next end screen with the cached rank, without fetching 100 rows again.
  const cached = cachedPromptRank();
  if (cached !== undefined) return cached;
  cachePromptRank(0); // claim the read before it starts (a second end screen mid-fetch won't refetch)
  try {
    const { rows } = await fetchBoard();
    const rank = hypotheticalRank(rows, myStats());
    cachePromptRank(rank);
    return rank;
  } catch {
    return null;
  }
}

/** My current rank on the live board (claimed players only), or null. */
export async function fetchMyRank() {
  const mine = getMyProfile();
  if (!LEADERBOARD_ENABLED || !mine || !mine.id) return null;
  try {
    const r = await fetch(`${BASE}/rest/v1/leaderboard?select=rank&id=eq.${encodeURIComponent(mine.id)}`, { headers: headers() });
    if (!r.ok) return null;
    const row = (await r.json())[0];
    return row ? Number(row.rank) : null;
  } catch {
    return null;
  }
}

const LAST_RANK_KEY = 'taw.lb.lastRank';
const RANK_NEWS_KEY = 'taw.lb.rankNews';
export function getLastRank() {
  try { const n = Number(localStorage.getItem(LAST_RANK_KEY)); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; }
}
export function setLastRank(n) {
  try { if (Number.isFinite(n) && n > 0) localStorage.setItem(LAST_RANK_KEY, String(n)); } catch { /* ignore */ }
}
export function hasRankNews() {
  try { return localStorage.getItem(RANK_NEWS_KEY) === '1'; } catch { return false; }
}
export function setRankNews(on) {
  try { if (on) localStorage.setItem(RANK_NEWS_KEY, '1'); else localStorage.removeItem(RANK_NEWS_KEY); } catch { /* ignore */ }
}

/**
 * Menu-mount check: compares my live rank with the last one this browser saw. Returns
 * { from, to } when it IMPROVED (and raises the trophy-badge flag), else null. Stores the new rank
 * either way, so a drop never shows a moment and the next rise is measured from the truth.
 */
export async function checkRankUp() {
  const now = await fetchMyRank();
  if (!now) return null;
  const before = getLastRank();
  setLastRank(now);
  if (before && now < before) {
    setRankNews(true);
    return { from: before, to: now };
  }
  return null;
}
