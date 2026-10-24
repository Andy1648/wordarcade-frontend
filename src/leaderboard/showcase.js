// showcase.js — LEADERBOARD PROFILES (Andy oct10: "click anyone on leaderboard to see their stats (only fun ones like
// gear(s), base, etc.)"; migration 031). LAZY: client.submitStats imports it after a successful push, and the board's
// profile card imports it on a tap — never in the menu's first paint.
//
//   myShowcase()       what this save shows: the worn gear(s), BASE wins / word, wins / word (WORD BOMB, 5 letters),
//                      gears found / total, POWER tier — the SAME numbers the game pays (wins.js / markRollsCore)
//   pushShowcase()     lb_showcase_set, only when it changed since the last send (and the DB keeps ≥ 20 s between)
//   fetchShowcase(id)  anyone's row from public.profile_showcase (null when they have none / 031 is not run)
import { wornMarkId, loadRollState, collection } from '../progress/markRollsCore.js';
import { wordWinsBase, perWordRateNow } from '../progress/wins.js';
import { getKeyTier } from '../progress/xp.js';
import { mark2Id, readClaimed, readCounters } from '../progress/v3/store.js';
import { readRecords } from '../progress/records.js';
import { readMain } from '../cast/cast.js';
import { readKit } from '../cast/kit.js';

const SENT_KEY = 'taw.s2.showcase3'; // the JSON last sent, so an unchanged showcase is never re-sent. '2' (042, oct13): every browser re-sends ONCE so a card an old audit blanked comes back
// '3' (oct19, Andy: "why has 一鸣惊人 equipped the boo hero but on leaderboard it still shows him as hex?"): that row's hero
// was NULL — its last send was taken by the pre-053 function (the hero dropped) yet stamped "stored for good" (v 50), and
// an unchanged showcase is never re-sent, so the board fell back to the id-hashed member (HEX). Every browser re-sends
// ONCE, and a send only counts as stored for good once the DB answers v >= STORED_V (it keeps the hero).
// 064 (oct24): the worn HERO COMPONENTS ride along — a send counts as stored once the DB answers v >= 64 (keeps them)
const STORED_V = 64;
// The DB drops a write that lands within 20 s of the row's last one (053's upsert `where updated_at < now() - 20 s`) yet
// still answers ok — so a hero picked right after a game's push silently never landed. A send inside that window waits
// it out instead (one timer; the latest showcase is read when it fires). The last send's time is kept in storage so a
// reload inside the window waits too.
const SENT_AT_KEY = 'taw.s2.showcase.at';
const DB_GAP_MS = 21000;
let retryTimer = 0;
// 046 PROFILE FLEX: a send counts as STORED only when the DB answers v >= 46 (it knows the badge / word columns). Before
// 046 runs, the old function drops those fields, so the same JSON is re-sent at most once every PRE46_RESEND_MS.
const PRE46_RESEND_MS = 6 * 3600 * 1000;
const BADGE_IDS = ['type', 'bots', 'reb', 'roll', 'win', 'chain', 'index', 'power'];
const WORD_RE = /^[a-z]{3,24}$/;
const num = (v) => (Number.isFinite(v) ? v : null);

export function myShowcase() {
  const c = collection(loadRollState());
  return {
    gear1: wornMarkId(),
    gear2: mark2Id(),
    base_wins: num(Math.round(wordWinsBase({}) * 10) / 10),
    wins_per_word: num(perWordRateNow({ mode: 'wordBomb' }).rate),
    gears_found: c.base,
    gears_total: c.total,
    power: num(getKeyTier()),
    ...flex(),
    title: null, // 050's TITLE slot — titles were removed (Andy oct17); null clears any title already stored
    hero: readMain(), // 053: the equipped hero, so the board shows YOUR pick to everyone (an older DB just ignores the key)
    ...kit(), // 064: the worn components (sidekick / frame / WIN FX); an older DB ignores the keys
  };
}

/** 064: the worn HERO COMPONENTS (cast/kit.js), null for an empty slot. */
function kit() {
  const k = readKit();
  return { pet: k.pet, frame: k.frame, fx: k.fx };
}

/** 046: the badges (top claimed tier per achievement), the SIGNATURE WORD (rarest ever accepted), the best CHAIN. */
function flex() {
  const claimed = readClaimed();
  const badges = {};
  for (const id of BADGE_IDS) if (claimed[id] > 0) badges[id] = claimed[id];
  const r = readRecords().rarest;
  const w = r && WORD_RE.test(r.word) ? r.word : null;
  return { badges, sig_word: w, sig_band: w ? r.band : null, best_chain: readCounters().chain || 0 };
}

export async function pushShowcase({ rpc, secret }) {
  if (!rpc || !secret) return false;
  const show = myShowcase();
  const json = JSON.stringify(show);
  try {
    const [was, at] = (localStorage.getItem(SENT_KEY) || '').split('\n');
    if (was === json && (!at || Date.now() - Number(at) < PRE46_RESEND_MS)) return false;
  } catch {
    /* blocked storage: send */
  }
  let last = 0;
  try { last = Number(localStorage.getItem(SENT_AT_KEY)) || 0; } catch { /* blocked storage: send now */ }
  const wait = last + DB_GAP_MS - Date.now();
  if (wait > 0 && wait <= DB_GAP_MS) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => { pushShowcase({ rpc, secret }).catch(() => {}); }, wait);
    return false;
  }
  clearTimeout(retryTimer); // sending now: a waiting retry has nothing left to do
  try {
    const r = await rpc('lb_showcase_set', { p_secret: secret, p_show: show });
    if (r && r.ok) {
      // stored for good only once the DB knows every field we send (053: the HERO) — before that, stamped so it
      // re-sends after PRE46_RESEND_MS
      try {
        localStorage.setItem(SENT_KEY, r.v >= STORED_V ? json : `${json}\n${Date.now()}`);
        localStorage.setItem(SENT_AT_KEY, String(Date.now()));
      } catch { /* blocked */ }
      return true;
    }
  } catch {
    /* 031 not run yet, offline — the card shows dashes */
  }
  return false;
}

// the same env client.js reads — duplicated so the read stays out of the menu's eager client chunk (payload ratchet)
const RAW_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const BASE = RAW_URL.replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

/** Anyone's showcase row (gear, BASE, POWER …) or null — none yet, 031 not run, offline. */
export async function fetchShowcase(id) {
  if (!BASE || !KEY || !id) return null;
  try {
    const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
    const r = await fetch(`${BASE}/rest/v1/profile_showcase?select=*&profile_id=eq.${encodeURIComponent(id)}`, { headers });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}

/** 053 + 064: the podium's looks in one read — { heroes: { id: hero }, pets: { id: sidekick } }. `select=*` so a DB
 *  before 064 (no pet column) still answers the heroes. */
export async function fetchPodium(ids) {
  const list = (ids || []).filter((x) => typeof x === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(x)).slice(0, 80);
  const out = { heroes: {}, pets: {} };
  if (!BASE || !KEY || !list.length) return out;
  try {
    const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
    const r = await fetch(`${BASE}/rest/v1/profile_showcase?select=*&profile_id=in.(${list.map(encodeURIComponent).join(',')})`, { headers });
    if (!r.ok) return out;
    for (const row of (await r.json()) || []) {
      if (!row || !row.profile_id) continue;
      if (typeof row.hero === 'string') out.heroes[row.profile_id] = row.hero;
      if (typeof row.pet === 'string') out.pets[row.profile_id] = row.pet;
    }
    return out;
  } catch {
    return out;
  }
}

// 051 PROFILE DESCRIPTION: saved straight away (not with the 20 s showcase push). Lives here, not in client.js, to keep the menu's first load inside its payload ratchet. The DB filters it again
// (public.bio_is_clean) — the client's bioVerdict is only the instant answer. → { ok } | { error }.
const BIO_KEY = 'taw.bio';
export function myBio() {
  try { return localStorage.getItem(BIO_KEY) || ''; } catch { return ''; }
}
export async function saveBio(text) {
  const t = String(text || '').trim();
  try {
    const { rpc, getSecret } = await import('./client.js'); // already loaded by the board — lazy here keeps it out of this chunk's graph
    const r = await rpc('lb_bio_set', { p_secret: getSecret(), p_bio: t });
    if (r && r.ok) {
      try { localStorage.setItem(BIO_KEY, t); } catch { /* blocked storage */ }
      return { ok: true };
    }
    return { error: (r && r.error) || 'fail' };
  } catch (e) {
    return { error: /lb_bio_set|PGRST202|http_404/.test(String(e && e.code)) ? 'not_ready' : 'fail' };
  }
}

// 052 THE UNLISTED: the found gears + serials the SERVER recorded for a player (public.unlisted_finds) — [] when none,
// 052 not run, offline. The profile card's UNLISTED shelf reads this, never the other player's device.
export async function fetchUnlistedFinds(id) {
  if (!BASE || !KEY || !id || !/^[A-Za-z0-9-]{1,64}$/.test(String(id))) return [];
  try {
    const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
    const r = await fetch(`${BASE}/rest/v1/unlisted_finds?select=gear_id,serial&profile_id=eq.${encodeURIComponent(id)}`, { headers });
    if (!r.ok) return [];
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
