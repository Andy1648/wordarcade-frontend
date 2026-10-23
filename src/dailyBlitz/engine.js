// dailyBlitz/engine.js — DAILY BLITZ, the once-a-day rare-answer game (the Krillion / Wordle loop on top of
// Category Blitz). PURE: no React, no DOM, no timers, no storage — the screen owns the clock, store.js owns
// localStorage, client.js owns the network. Everything here runs under `node --test`.
//
// THE GAME: everyone gets the SAME six prompts today (two EASY, two MEDIUM, two NICHE — pool.js), drawn
// from the Category Blitz lists. One answer per prompt, ROUND_MS each. A valid answer scores by how RARE it
// is: an answer nobody else thought of is worth up to 100, the obvious one ~10. A miss is 0. Max 600.
//
// RARITY has two sources:
//   * PRIOR (20..80, data.json): how familiar the answer's words are, ranked within its own list — the
//     repo's word-rarity corpus (words.recall.txt) applied per category. It is the guess on a quiet day.
//   * CROWD: once the day has tallies (client.js), "X% of players said this" — crowdPoints(). It blends
//     in from CROWD_MIN plays and fully replaces the prior at CROWD_FULL, so the score is the real
//     answer distribution as soon as there is one, and never a 3-player coin flip.
//
// DAY: the player's LOCAL calendar date (dailySeed.localDateKey — it flips at their midnight, like Wordle),
// numbered from 2026-01-01 = #1 (the same epoch as the old Daily Challenge's day numbers).
import { dailyRng } from '../daily/dailySeed.js';
import { DAILY_POOL, PER_TIER, TIER_ORDER } from './pool.js';
import { answerKey } from './answerKey.js';
import { PROMPTS } from './day.js';

export { PROMPTS, dayNumberFor, dateKeyFor } from './day.js';
export const ROUND_MS = 20000;
export const MAX_POINTS = 100;
export const CROWD_MIN = 10; // plays before the crowd starts to count
export const CROWD_FULL = 50; // plays at which the crowd is the whole score

// A deterministic shuffle of `arr` for (tier, cycle) — the same order on every machine.
function shuffled(arr, tier, cycle) {
  const out = arr.slice().sort();
  const rnd = dailyRng(`cycle-${cycle}`, `dailyblitz-${tier}`);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

/**
 * The day's prompts (category names), in play order: EASY, EASY, MEDIUM, MEDIUM, NICHE, NICHE.
 * Each tier walks a seeded permutation of its pool in CYCLES (floor(pool / PER_TIER) days long), so a
 * category never repeats inside a cycle — a week of dailies never shows the same list twice.
 */
export function promptsForDay(dayNumber, pool = DAILY_POOL) {
  const out = [];
  for (const tier of TIER_ORDER) {
    const names = pool[tier] || [];
    const len = Math.max(1, Math.floor(names.length / PER_TIER));
    const d = Math.max(0, Math.floor(dayNumber) - 1);
    const cycle = Math.floor(d / len);
    const at = (d % len) * PER_TIER;
    out.push(...shuffled(names, tier, cycle).slice(at, at + PER_TIER));
  }
  return out;
}

// ---- judging -----------------------------------------------------------------------------------------

const indexCache = new WeakMap();
function indexOf(cat) {
  let idx = indexCache.get(cat);
  if (!idx) {
    idx = new Map(cat.a.map(([k, d, p]) => [k, { key: k, display: d, prior: p }]));
    indexCache.set(cat, idx);
  }
  return idx;
}

/**
 * Judge a typed answer against a category's list (data.json shape: { a: [[key, display, prior]], alias }).
 * -> { ok: true, key, display, prior } with `key` the CANONICAL key (a plural / typo variant the list
 *    accepts tallies as its main spelling), or { ok: false, reason: 'empty' | 'not_on_list' }.
 */
export function judge(cat, typed) {
  const raw = answerKey(typed);
  if (!raw) return { ok: false, reason: 'empty' };
  if (!cat || !Array.isArray(cat.a)) return { ok: false, reason: 'not_on_list' };
  const key = (cat.alias && cat.alias[raw]) || raw;
  const hit = indexOf(cat).get(key);
  return hit ? { ok: true, ...hit } : { ok: false, reason: 'not_on_list' };
}

/** The display spelling for a canonical key (for the day's "most common answers"), or null. */
export function displayFor(cat, key) {
  const hit = cat && Array.isArray(cat.a) ? indexOf(cat).get(key) : null;
  return hit ? hit.display : null;
}

// ---- scoring -----------------------------------------------------------------------------------------

/** Points for an answer `pct` (0..1) of players gave: 50% -> 21, 10% -> 76, 1% -> 97, nobody else -> 100. */
export function crowdPoints(pct) {
  const p = Math.min(1, Math.max(0, Number(pct) || 0));
  return Math.round(10 + 90 * Math.pow(1 - p, 3));
}

/** How much the crowd counts, 0..1, at `plays` players today. */
export function crowdWeight(plays) {
  const n = Number(plays) || 0;
  if (n < CROWD_MIN) return 0;
  return Math.min(1, (n - CROWD_MIN) / (CROWD_FULL - CROWD_MIN));
}

/**
 * One answer's points. `row` = { prior } (null/undefined prior = a miss -> 0). `crowd` = { count, plays }
 * for this answer today (count INCLUDES this player), or null when there are no tallies yet.
 */
export function scoreAnswer(row, crowd = null) {
  if (!row || !Number.isFinite(row.prior)) return 0;
  const w = crowd ? crowdWeight(crowd.plays) : 0;
  if (w <= 0) return Math.round(row.prior);
  const pct = crowd.plays > 0 ? crowd.count / crowd.plays : 0;
  return Math.round(w * crowdPoints(pct) + (1 - w) * row.prior);
}

// The rarity bands — the same names + colours as the WINS rarity bands (progress/rarity.js), so a RARE
// answer here reads like a RARE word everywhere else. `glyph` is the share-card square.
export const BANDS = [
  { id: 'miss', name: 'MISS', min: -Infinity, glyph: '⬛', color: '#3a2a52' },
  { id: 'common', name: 'COMMON', min: 1, glyph: '⬜', color: '#F0EAD9' },
  { id: 'uncommon', name: 'UNCOMMON', min: 35, glyph: '🟦', color: '#2EFFE0' },
  { id: 'rare', name: 'RARE', min: 55, glyph: '🟪', color: '#9A1AFF' },
  { id: 'obscure', name: 'OBSCURE', min: 75, glyph: '🟨', color: '#FFD54A' },
];

/** The band for a point value (0 = MISS). */
export function bandFor(points) {
  const p = Number(points) || 0;
  let b = BANDS[0];
  for (const x of BANDS) if (p >= x.min) b = x;
  return b;
}

/**
 * Score a finished day. `rows` = PROMPTS entries of { cat, key, display, prior } (key null = miss);
 * `tallies` = client.js's shape { plays, prompts: [{ mine, top: [[key, count]] }] } or null.
 * -> { rows: [...rows + { points, band, pct }], total, rarest } — rarest = index of the best answer.
 */
export function scoreDay(rows, tallies = null) {
  const plays = tallies && Number(tallies.plays) > 0 ? Number(tallies.plays) : 0;
  const out = rows.map((r, i) => {
    if (!r || !r.key) return { ...r, points: 0, band: bandFor(0), pct: null };
    const t = tallies && tallies.prompts ? tallies.prompts[i] : null;
    const count = t && Number.isFinite(t.mine) ? Math.max(1, t.mine) : null;
    const crowd = plays && count ? { count, plays } : null;
    const points = scoreAnswer(r, crowd);
    return { ...r, points, band: bandFor(points), pct: crowd ? count / plays : null };
  });
  let rarest = -1;
  out.forEach((r, i) => {
    if (r.points > 0 && (rarest < 0 || r.points > out[rarest].points)) rarest = i;
  });
  return { rows: out, total: out.reduce((s, r) => s + r.points, 0), rarest };
}

/** "31%" / "<1%" for a share 0..1. */
export function formatPct(p) {
  if (!Number.isFinite(p)) return '';
  const v = p * 100;
  if (v > 0 && v < 1) return '<1%';
  return `${Math.round(v)}%`;
}

// ---- share -------------------------------------------------------------------------------------------

export const SHARE_PARAM = 's=share';

/** The share deep link: lands a friend straight in today's DAILY BLITZ, tagged so the visit is counted. */
export function shareLink(origin = 'https://typeaword.com') {
  return `${String(origin).replace(/\/+$/, '')}/daily?${SHARE_PARAM}`;
}

/**
 * The spoiler-free share text: one square per prompt (its rarity band), the score, the streak, the link.
 * Never names a category or an answer.
 *   TYPE A WORD · DAILY BLITZ #295
 *   🟪🟨⬜⬛🟦🟪 412/600
 *   🔥 3-DAY STREAK
 *   https://typeaword.com/daily?s=share
 */
export function buildShareText({ dayNumber, rows = [], total = 0, streak = 0, origin } = {}) {
  const squares = rows.map((r) => (r && r.band ? r.band.glyph : bandFor(r && r.points).glyph)).join('');
  const lines = [`TYPE A WORD · DAILY BLITZ #${dayNumber}`, `${squares} ${total}/${PROMPTS * MAX_POINTS}`];
  if (streak >= 2) lines.push(`🔥 ${streak}-DAY STREAK`);
  lines.push(shareLink(origin));
  return lines.join('\n');
}
