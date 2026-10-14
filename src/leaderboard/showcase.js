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

const SENT_KEY = 'taw.s2.showcase2'; // the JSON last sent, so an unchanged showcase is never re-sent. '2' (042, oct13): every browser re-sends ONCE so a card an old audit blanked comes back
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
  };
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
  try {
    const r = await rpc('lb_showcase_set', { p_secret: secret, p_show: show });
    if (r && r.ok) {
      // stored for good once 046 answers; before that, stamped so it re-sends after PRE46_RESEND_MS
      try { localStorage.setItem(SENT_KEY, r.v >= 46 ? json : `${json}\n${Date.now()}`); } catch { /* blocked */ }
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
