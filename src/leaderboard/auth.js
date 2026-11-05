// auth.js — SIGN IN WITH GOOGLE (Andy nov4: "progress is never lost and purchases are secure"; 085_google_signin.sql).
// Supabase Auth's Google provider over plain fetch (no supabase-js — the same choice as client.js), lazy: nothing here
// rides the menu's first load; main.jsx only imports it when a sign-in landing this tab STARTED comes back.
//
// PKCE (security review nov4, HIGH 2 — no more #access_token landings): signInWithGoogle keeps a random code VERIFIER in
// this tab's sessionStorage and sends Supabase only its SHA-256 CHALLENGE; Google comes back to /?code=…, and the code is
// worth nothing without the verifier, which never left this tab. index.html's first (inline, minified) script runs before
// ANY other script, analytics included: it lifts a ?signin=1&code= into sessionStorage (PKCE_CODE_KEY) and wipes any
// #access_token / #refresh_token from the address bar unread. A landing this tab did not start (no verifier — a link
// someone else made) is dropped unread; a #access_token in the URL is never read at all (index.html scrubs it before
// any script, analytics included, can see it). And nothing links a board row without the player saying LINK.
//
//   signInWithGoogle()   verifier → /auth/v1/authorize?provider=google&code_challenge=…&code_challenge_method=s256 →
//                        Google → back to THIS origin's /?signin=1&code=… (Supabase's redirect allow-list: our origins only)
//   pickUpCode()         the landing: index.html already moved the code into sessionStorage; trade code + verifier for
//                        the session (/auth/v1/token?grant_type=pkce) into taw.auth
//   finishSignIn()       what the account says: offer to LINK this device's board row (confirm), RESTORE the account's row
//                        onto this device (a confirm first when this device has progress of its own), or wait for a name
//   signOut()            drops the Google session only — the device secret, the name and every bit of progress stay
//
// OPTIONAL TO PLAY, REQUIRED TO BUY GEMS (api/checkout.js sends this session's access token; 085 pay_reserve checks the
// link). NO PII on our side: the server stores the auth uid + the link; the email is kept ONLY in this browser
// (taw.auth) so Settings can say whose account is signed in — never sent anywhere, never shown publicly.
import { LEADERBOARD_ENABLED, getMyProfile, peekSecret, restoreFromCloud, adoptSecret } from './client.js';
import { wipeProgressKeys, localScore, progressScoreFromKeys } from '../save/cloudSave.js';
import { GOOGLE_ON } from './googleFlag.js';

const RAW_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const BASE = RAW_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

export const AUTH_KEY = 'taw.auth'; // { access, refresh, exp (ms), email }
export const AUTH_PENDING_KEY = 'taw.auth.pending'; // the restore waiting on the player's OK: { username, level, rebirths }
export const AUTH_CHANGE = 'taw:auth-change';
export const authAvailable = () => GOOGLE_ON && LEADERBOARD_ENABLED && !!BASE && !!KEY; // VITE_GOOGLE_ON (googleFlag.js)

const tell = () => { try { window.dispatchEvent(new Event(AUTH_CHANGE)); } catch { /* node */ } };
function readJson(k) {
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; }
}
function writeJson(k, v) {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch { /* blocked */ }
}

/** The stored session (may be expired — `session()` renews it). */
export function readSession() {
  const s = readJson(AUTH_KEY);
  return s && typeof s.access === 'string' && s.access ? s : null;
}
export const signedIn = () => !!readSession();
export const pendingRestore = () => readJson(AUTH_PENDING_KEY);

/** The email out of an access token's payload (display only, this browser only). */
function emailOf(jwt) {
  try {
    const p = JSON.parse(atob(String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof p.email === 'string' ? p.email : '';
  } catch {
    return '';
  }
}

export const PKCE_KEY = 'taw.pkce'; // sessionStorage (this tab only): { v: the code verifier, at }
export const PKCE_CODE_KEY = 'taw.pkce.code'; // sessionStorage: the ?code= index.html lifted out of the address bar
const PKCE_MAX_AGE = 15 * 60_000; // a sign-in left half-done for longer than this is stale
const ss = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* blocked */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* blocked */ } },
};
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** The PKCE pair: a 64-char verifier (RFC 7636 alphabet) and its S256 challenge. */
export async function pkcePair() {
  const raw = new Uint8Array(48);
  crypto.getRandomValues(raw);
  const v = b64url(raw);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  return { verifier: v, challenge: b64url(digest) };
}

/** Off to Google — back to THIS origin only (the redirect is never taken from a caller or a URL). */
export async function signInWithGoogle() {
  if (!authAvailable()) return false;
  const { verifier, challenge } = await pkcePair();
  ss.set(PKCE_KEY, JSON.stringify({ v: verifier, at: Date.now() }));
  const back = `${location.origin}/?signin=1`;
  location.assign(`${BASE}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=s256`);
  return true;
}

/** The landing: trade the code index.html kept for the session, with THIS tab's verifier. A code with no verifier
 *  here (a landing this tab did not start), a stale one, or a refused trade is dropped — nothing is stored. */
export async function pickUpCode() {
  const code = ss.get(PKCE_CODE_KEY);
  ss.del(PKCE_CODE_KEY);
  let pk = null;
  try { pk = JSON.parse(ss.get(PKCE_KEY) || 'null'); } catch { pk = null; }
  ss.del(PKCE_KEY);
  if (!code || !pk || typeof pk.v !== 'string' || !(Date.now() - pk.at < PKCE_MAX_AGE)) return false;
  try {
    const r = await fetch(`${BASE}/auth/v1/token?grant_type=pkce`, {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_code: code, code_verifier: pk.v }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    if (!d || typeof d.access_token !== 'string') return false;
    writeJson(AUTH_KEY, { access: d.access_token, refresh: d.refresh_token || '', exp: Date.now() + (Number(d.expires_in) || 3600) * 1000, email: emailOf(d.access_token) });
    tell();
    return true;
  } catch {
    return false;
  }
}

/** A live access token, renewed with the refresh token when it is (nearly) out. null = signed out / can't renew. */
export async function session() {
  const s = readSession();
  if (!s) return null;
  if (s.exp - Date.now() > 60_000) return s;
  if (!s.refresh) return null;
  try {
    const r = await fetch(`${BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh }),
    });
    if (!r.ok) {
      if (r.status === 400 || r.status === 401) { writeJson(AUTH_KEY, null); tell(); } // revoked: signed out
      return null;
    }
    const d = await r.json();
    const next = { access: d.access_token, refresh: d.refresh_token || s.refresh, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000, email: emailOf(d.access_token) || s.email };
    writeJson(AUTH_KEY, next);
    return next;
  } catch {
    return null; // offline: try again later
  }
}

/** A PostgREST call AS the signed-in user (auth.uid() on the server). Throws { code } like client.rpc. */
export async function authRpc(fn, body = {}) {
  const s = await session();
  if (!s) throw Object.assign(new Error('sign_in'), { code: 'sign_in' });
  const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${s.access}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw Object.assign(new Error((data && data.message) || `http_${r.status}`), { code: (data && data.message) || `http_${r.status}`, status: r.status });
  return data;
}

/** Sign out of Google here. Progress, the name and the device secret all stay. */
export async function signOut() {
  const s = readSession();
  writeJson(AUTH_KEY, null);
  writeJson(AUTH_PENDING_KEY, null);
  tell();
  if (s) {
    try { await fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${s.access}` } }); } catch { /* best effort */ }
  }
}

const newSecret = () => {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

/**
 * After sign-in: line the Google account up with this device. Resolves one of
 *   { state: 'linked' }                 this device's board row is (now) the account's
 *   { state: 'confirm', who }           the account has a DIFFERENT row and this device has progress: ask first
 *                                       (who = { username, level, rebirths } — AUTH_PENDING_KEY holds it too)
 *   { state: 'restored' }               the account's row + cloud save are now this device's (reload to see it)
 *   { state: 'no_name' }                signed in, nothing to link yet: claiming a name links it (client.claimName)
 *   { state: 'error', reason }
 */
export async function finishSignIn() {
  let st;
  try { st = await authRpc('lb_auth_status'); } catch (e) { return { state: 'error', reason: e.code || 'offline' }; }
  if (!st || st.ok !== true) return { state: 'error', reason: (st && st.reason) || 'offline' };
  const me = getMyProfile();
  const secret = peekSecret();
  if (st.linked) {
    if (me && me.id === st.profile_id) { writeJson(AUTH_PENDING_KEY, null); return { state: 'linked' }; }
    const who = { username: st.username, level: st.level, rebirths: st.rebirths };
    const hasOwn = !!me || localScore() > progressScoreFromKeys({}); // a name, or past a fresh save's LV 1
    if (hasOwn) { writeJson(AUTH_PENDING_KEY, who); tell(); return { state: 'confirm', who }; }
    return restoreAccount();
  }
  if (!me || !secret) return { state: 'no_name' };
  // never link without the player saying so (review HIGH 2): the landing asks LINK <NAME>? first
  return { state: 'confirm_link', who: { username: me.username, email: (readSession() || {}).email || '' } };
}

/** Link this device's board row to the signed-in account (also run after a name is claimed while signed in). */
export async function linkThisDevice() {
  const secret = peekSecret();
  if (!secret || !getMyProfile()) return { state: 'no_name' };
  try {
    const r = await authRpc('lb_auth_link', { p_secret: secret });
    if (r && r.ok) { writeJson(AUTH_PENDING_KEY, null); tell(); return { state: 'linked' }; }
    return { state: 'error', reason: (r && r.reason) || 'offline' };
  } catch (e) {
    return { state: 'error', reason: e.code || 'offline' };
  }
}

/**
 * RESTORE: this device takes the account's board row + cloud save. The device gets its OWN new secret (085 adds it to
 * the profile; other devices keep theirs), this device's own progress is cleared, and the cloud save loads. The caller
 * reloads so every module re-reads it.
 */
export async function restoreAccount() {
  const fresh = newSecret();
  let r;
  try { r = await authRpc('lb_auth_restore', { p_new_secret: fresh }); } catch (e) { return { state: 'error', reason: e.code || 'offline' }; }
  if (!r || !r.ok) return { state: 'error', reason: (r && r.reason) || 'offline' };
  wipeProgressKeys(localStorage, [AUTH_KEY]);
  adoptSecret(fresh, { id: r.profile_id, username: r.username });
  writeJson(AUTH_PENDING_KEY, null);
  const loaded = await restoreFromCloud({ restore: true });
  tell();
  return { state: 'restored', loaded: !!(loaded && loaded.restored), username: r.username };
}

/** The player said no to the restore: stay signed out of that account on this device (nothing changes here). */
export async function declineRestore() {
  await signOut();
}
