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
    const err = new Error((data && data.message) || `http_${r.status}`);
    err.code = (data && data.message) || `http_${r.status}`;
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

/** The numbers this browser reports: level, rebirths, lifetime words (every mode), WINS/WORD. */
export function myStats() {
  let words = 0;
  for (const m of MASTERY_MODES) words += masteryWords(m) || 0;
  let wpw = 0;
  try { wpw = perWordRateNow({ mode: 'word-bomb' }).rate || 0; } catch { wpw = 0; }
  return { level: readLevel(), rebirths: getRebirths() || 0, lifetimeWords: words, winsPerWord: Math.round(wpw * 10) / 10 };
}

// ---- API -------------------------------------------------------------------------------------
/** 'ok' | 'shape' | 'blocked' | 'taken' — the server's verdict on a name (no secret needed). */
export async function nameStatus(username) {
  if (!LEADERBOARD_ENABLED) return 'ok';
  return rpc('lb_name_status', { p_username: username });
}

/** Claim (or rename to) `username`. Resolves to the profile; rejects with err.code in
 *  username_taken | username_blocked | username_shape | bad_secret | http_*. Pushes stats at once. */
export async function claimName(username) {
  const secret = getSecret();
  if (!LEADERBOARD_ENABLED || !secret) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  const row = await rpc('lb_claim', { p_secret: secret, p_username: username });
  saveMyProfile(row);
  lastSubmit = 0;
  await submitStats(true);
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
    await rpc('lb_submit', {
      p_secret: getSecret(),
      p_level: s.level,
      p_rebirths: s.rebirths,
      p_lifetime_words: s.lifetimeWords,
      p_wins_per_word: s.winsPerWord,
    });
    return true;
  } catch {
    return false;
  }
}

/** The top of the board + (if I have a name and I'm below it) my own row. */
export async function fetchBoard(limit = BOARD_SIZE) {
  if (!LEADERBOARD_ENABLED) return { rows: [], me: null };
  const cols = 'rank,id,username,level,rebirths,lifetime_words,wins_per_word';
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
