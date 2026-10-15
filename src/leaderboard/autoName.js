// autoName.js — EVERY VISITOR GETS A NAME (Andy oct13: "anyone who opens website autogenerates username (kind of like
// when joining game) on leaderboard (no need for sign up bc that already too high barrier)").
//
// LAZY: the menu imports this on the visitor's FIRST key / tap (a bounce or a bot that never touches the page never
// claims a row). If this browser has no board name yet, it claims one through the normal claimName() door — the same
// lb_claim the CLAIM prompt uses (shape, blocklist, taken, rate limits all server-side; 040 raised the limits for
// this). The name: the one this player already uses in multiplayer (playerName.js, wa_playername) when it fits the
// board's shape, else a fresh generated handle (NEONGOBLIN42 — the quick-play generator), remembered for multiplayer
// too so the player is ONE name everywhere. Taken → a new handle, up to 3 tries; anything else (offline, rate
// limited, storage blocked) → give up quietly for this page load (the next visit tries again). Renaming stays where
// it was: CHANGE on the leaderboard (an auto name's first rename is never on cooldown — 008's rule).
import { LEADERBOARD_ENABLED, getMyProfile, claimName } from './client.js';
import { getStoredName, randomPlayerName, rememberName } from '../playerName.js';

const SHAPE = /^[A-Za-z0-9_]{3,16}$/; // the board's ASCII rule (lb_claim); CJK names go through the CLAIM prompt
let started = false;

/** PURE: the name to try first — the multiplayer name if the board would take it, else a generated one. */
export function firstName(stored = getStoredName(), gen = randomPlayerName) {
  const s = String(stored || '').trim();
  return SHAPE.test(s) ? s : gen().slice(0, 16);
}

/** Claim a board name for a browser that has none. Once per page load; never throws. Resolves to the row or null. */
export async function autoName({ claim = claimName, gen = randomPlayerName } = {}) {
  if (started) return null;
  started = true;
  try {
    if (!LEADERBOARD_ENABLED || getMyProfile()) return null;
    if (typeof window !== 'undefined' && window.__TAW_NO_AUTONAME) return null; // e2e: specs that need an unclaimed board
    let name = firstName(undefined, gen);
    for (let i = 0; i < 3; i++) {
      try {
        const row = await claim(name);
        if (!getStoredName()) rememberName(row && row.username ? row.username : name);
        return row || null;
      } catch (e) {
        if (!e || (e.code !== 'username_taken' && e.code !== 'username_blocked' && e.code !== 'username_shape')) return null;
        name = gen().slice(0, 16);
      }
    }
  } catch {
    /* never in the way */
  }
  return null;
}

/** test seam */
export function __resetAutoName() {
  started = false;
}
