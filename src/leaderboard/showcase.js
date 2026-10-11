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
import { mark2Id } from '../progress/v3/store.js';

const SENT_KEY = 'taw.s2.showcase'; // the JSON last sent, so an unchanged showcase is never re-sent
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
  };
}

export async function pushShowcase({ rpc, secret }) {
  if (!rpc || !secret) return false;
  const show = myShowcase();
  const json = JSON.stringify(show);
  try {
    if (localStorage.getItem(SENT_KEY) === json) return false;
  } catch {
    /* blocked storage: send */
  }
  try {
    const r = await rpc('lb_showcase_set', { p_secret: secret, p_show: show });
    if (r && r.ok) {
      try { localStorage.setItem(SENT_KEY, json); } catch { /* blocked */ }
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
    const r = await fetch(`${BASE}/rest/v1/profile_showcase?select=gear1,gear2,base_wins,wins_per_word,gears_found,gears_total,power&profile_id=eq.${encodeURIComponent(id)}`, { headers });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  } catch {
    return null;
  }
}
