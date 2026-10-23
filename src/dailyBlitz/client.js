// dailyBlitz/client.js — DAILY BLITZ's two Supabase calls (migration 062): submit today's answers once and
// get the day's tallies back, or read the tallies again on a revisit. Uses the leaderboard's RPC helper and
// its per-browser random secret (no account, no name, no PII — the server only keeps a salted hash of it).
//
// Never blocks play: every call has a short timeout and resolves to null on any failure (no env, offline,
// the migration not run yet), and the results screen simply scores on the prior and shows no percentages.
import { rpc, getSecret, LEADERBOARD_ENABLED } from '../leaderboard/client.js';
import { PROMPTS } from './engine.js';

const TIMEOUT_MS = 4000;

function withTimeout(p) {
  return Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS))]);
}

/** The server's tallies, normalised (or null when the payload is not the 062 shape). */
export function parseTallies(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.prompts)) return null;
  const plays = Math.max(0, Number(data.plays) || 0);
  const prompts = [];
  for (let i = 0; i < PROMPTS; i++) {
    const p = data.prompts[i] || {};
    const top = Array.isArray(p.top)
      ? p.top.filter((t) => Array.isArray(t) && typeof t[0] === 'string').map((t) => [t[0], Math.max(0, Number(t[1]) || 0)])
      : [];
    prompts.push({ mine: Number.isFinite(p.mine) ? p.mine : null, top });
  }
  return { plays, prompts };
}

function answersArg(keys) {
  const out = [];
  for (let i = 0; i < PROMPTS; i++) {
    const k = keys[i];
    out.push(typeof k === 'string' && /^[a-z0-9]{1,48}$/.test(k) ? k : '');
  }
  return out;
}

/** Record today's six canonical answer keys (null/'' = a miss) and get the tallies. null on failure. */
export async function submitDay(dateKey, keys) {
  if (!LEADERBOARD_ENABLED) return null;
  try {
    const secret = getSecret();
    if (!secret) return null;
    const data = await withTimeout(rpc('daily_blitz_submit', { p_secret: secret, p_day: dateKey, p_answers: answersArg(keys) }));
    return parseTallies(data);
  } catch {
    return null;
  }
}

/** Read the day's tallies (a results revisit). null on failure. */
export async function fetchTallies(dateKey, keys) {
  if (!LEADERBOARD_ENABLED) return null;
  try {
    const data = await withTimeout(rpc('daily_blitz_tallies', { p_day: dateKey, p_answers: answersArg(keys) }));
    return parseTallies(data);
  } catch {
    return null;
  }
}
