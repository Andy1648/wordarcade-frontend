// auth.js — SIGN IN WITH GOOGLE (Andy nov4: "progress is never lost and purchases are secure"; 085_google_signin.sql).
// Google Identity Services + Supabase Auth over plain fetch (no supabase-js — the same choice as client.js), lazy: nothing
// here rides the menu's first load; it comes with the sign-in button.
//
// GIS (nov4, Andy: Google's redirect screen said "continue to <project>.supabase.co", and a popup beats leaving the page):
// Google's OWN button opens Google's popup on this page, and hands back an ID token in a JS callback. It never touches
// the URL, so there is no landing to forge. NONCE: a fresh random one per attempt, kept in memory here; Google gets its
// SHA-256 (hex), and Supabase gets the raw value and checks that the token was minted for it. This file also refuses a
// token whose nonce or audience isn't ours before anything is sent. Nothing links a board row without the player saying LINK.
//
//   renderGoogleButton(el)  loads accounts.google.com/gsi/client on first use, then draws Google's button in `el`
//   finishSignIn()       what the account says: offer to LINK this device's board row (confirm), RESTORE the account's row
//                        onto this device (a confirm first when this device has progress of its own), or wait for a name
//   signOut()            drops the Google session only — the device secret, the name and every bit of progress stay
//
// WHAT GIS CAN'T TELL US: the button flow has no callback for a closed popup or a school admin's block — Google shows
// its own message in the popup and this page hears nothing. So GoogleAccount.jsx times it: a click with no sign-in after a
// while says what to try. The script failing to load (a school filter) IS detectable: loadGsi rejects, and the button
// becomes a clear message + RETRY.
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
// public, not a secret: Google's button needs it in the page. The env var only overrides it (the e2e build, another project)
const CLIENT_ID = (import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || '1049744251053-glmrnk5l02aoudbnoa4jkbn15k2elsss.apps.googleusercontent.com';

export const AUTH_KEY = 'taw.auth'; // { access, refresh, exp (ms), email }
export const AUTH_PENDING_KEY = 'taw.auth.pending'; // the restore waiting on the player's OK: { username, level, rebirths }
export const AUTH_CHANGE = 'taw:auth-change';
export const AUTH_LANDED = 'taw:auth-landed'; // detail: { state } — the landing has settled (linked, no_name, a refusal): a waiting purchase moves on
export const AUTH_FAIL = 'taw:auth-fail'; // detail: { reason } — the button says what went wrong and re-arms
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

// ---- Google Identity Services ----------------------------------------------------------------------------------------
const GSI_SRC = 'https://accounts.google.com/gsi/client';
const GSI_TIMEOUT_MS = 8000;
let gsiLoad = null;
/** The GIS library, loaded once on first use. Rejects when it can't load (a school filter, offline); a later call retries. */
export function loadGsi() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (gsiLoad) return gsiLoad;
  gsiLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const t = setTimeout(() => fail(), GSI_TIMEOUT_MS);
    function fail() { clearTimeout(t); s.remove(); gsiLoad = null; reject(new Error('gsi_blocked')); }
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => {
      clearTimeout(t);
      if (window.google && window.google.accounts && window.google.accounts.id) resolve(window.google.accounts.id);
      else fail();
    };
    s.onerror = fail;
    document.head.appendChild(s);
  });
  return gsiLoad;
}

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
let nonce = null; // { raw, hashed } of the attempt the button is armed for — memory only, one use
/** Arm GIS with a fresh nonce (GIS's `initialize` overwrites the last config; it runs once per attempt, not per render). */
async function armNonce(gsi) {
  const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)));
  nonce = { raw, hashed };
  gsi.initialize({ client_id: CLIENT_ID, callback: onCredential, nonce: hashed, ux_mode: 'popup', auto_select: false, context: 'signin' });
}

/** Draw Google's own button in `el` (its look and its ~40 px height are Google's; it can't be restyled). */
export async function renderGoogleButton(el, width, onClick) {
  const gsi = await loadGsi();
  if (!nonce) await armNonce(gsi);
  el.textContent = '';
  gsi.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'left', width: Math.max(200, Math.min(400, Math.round(width) || 280)), click_listener: onClick });
}

function claimsOf(jwt) {
  try { return JSON.parse(atob(String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
}
const failed = (reason) => {
  try { window.dispatchEvent(new CustomEvent(AUTH_FAIL, { detail: { reason } })); } catch { /* node */ }
};

/** GIS's callback: the ID token for THIS attempt → a Supabase session → the landing (LINK / RESTORE). */
async function onCredential(resp) {
  const used = nonce;
  nonce = null; // one use, whatever happens: the button re-arms before it can be pressed again
  const r = await exchangeIdToken(resp && resp.credential, used);
  if (!r.ok) { failed(r.reason); return; }
  tell();
  (await import('../components/account/mountLanding.jsx')).mountLanding();
}

/** -> { ok } | { ok: false, reason: 'nonce' | 'refused' | 'offline' }. A token not minted for this attempt and this app is never sent. */
export async function exchangeIdToken(idToken, used) {
  const c = claimsOf(idToken);
  if (!c || !used || c.nonce !== used.hashed || c.aud !== CLIENT_ID) return { ok: false, reason: 'nonce' };
  try {
    const r = await fetch(`${BASE}/auth/v1/token?grant_type=id_token`, {
      method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google', id_token: idToken, nonce: used.raw }),
    });
    if (!r.ok) return { ok: false, reason: 'refused' };
    const d = await r.json();
    if (!d || typeof d.access_token !== 'string') return { ok: false, reason: 'refused' };
    writeJson(AUTH_KEY, { access: d.access_token, refresh: d.refresh_token || '', exp: Date.now() + (Number(d.expires_in) || 3600) * 1000, email: emailOf(d.access_token) });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'offline' };
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
