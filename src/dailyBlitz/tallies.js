// dailyBlitz/tallies.js — the 062 tallies payload, normalised. A LEAF (engine's PROMPTS only): the client
// (client.js) and the server-rendered answers page (api/daily-answers.js) share it.
import { PROMPTS } from './day.js';

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
