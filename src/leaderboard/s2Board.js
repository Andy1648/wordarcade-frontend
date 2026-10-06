// s2Board.js — the maths behind the v2 LEADERBOARD (P8, claude/mockups/v2/Leaderboard.dc.html; SEASON2 only). PURE —
// no DOM, no storage — so node:test covers it (s2Board.test.js).
//
//   * the board order is ★ desc → rebirths desc → level desc (022_season2_board.sql leaderboard_s2);
//   * every name wears its v3 RANK plate (KEYMASH … ENDGAME, progress/v3/ranks.js — by rebirths, then ★);
//   * ▲▼ = the place a player held when this browser last looked (a per-tab snapshot) vs now;
//   * CHASE = what it takes to pass the player directly above you, in the board's own order;
//   * CLIMB = what it takes to reach your next rank;
//   * THIS WEEK gains mirror 024_season2_weekly.sql's leaderboard_s2_weekly (s2WeekGains).
import { RANKS_V3, rankIndexV3 } from '../progress/v3/ranks.js';

const int0 = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const lv1 = (v) => Math.max(1, int0(v));

// The mockup's plate colour per rank (its 16-step LADDER, in the v3 order). ENDGAME is the inverted black plate.
const PLATE_BG = ['#c9b8e8', '#c9b8e8', '#c9b8e8', '#2EFFE0', '#2EFFE0', '#2EFFE0', '#D88BFF', '#D88BFF', '#B04BFF', '#FFC23D', '#FFC23D', '#FFE94A', '#FF3D7F', '#FF3D7F', '#FF3D7F', '#000'];

/** The rank plate for a row: { i, name, bg, ink, line } — the v3 rank by rebirths, then ★. */
export function rankPlate(row) {
  const i = rankIndexV3({ rebirths: int0(row && row.rebirths), stars: int0(row && row.stars) });
  const name = RANKS_V3[i].name;
  return name === 'ENDGAME'
    ? { i, name, bg: '#000', ink: '#FFE94A', line: '#FFE94A' }
    : { i, name, bg: PLATE_BG[i], ink: '#000', line: '#000' };
}

/** The board's own order (★ → R → level → words): < 0 when `a` ranks above `b`. */
export function compareS2(a, b) {
  return int0(b.stars) - int0(a.stars) || int0(b.rebirths) - int0(a.rebirths) || lv1(b.level) - lv1(a.level)
    || int0(b.lifetime_words) - int0(a.lifetime_words);
}

/**
 * ▲▼ for each row: `seen` is { [id]: rank } from this browser's last look at the same tab. Returns { [id]: n } with
 * n > 0 = up n places, n < 0 = down, 0 = same place or not seen before.
 */
export function boardMoves(rows, seen) {
  const out = {};
  const prev = seen && typeof seen === 'object' ? seen : {};
  for (const r of rows || []) {
    if (!r || r.id == null) continue;
    const was = int0(prev[r.id]);
    const now = int0(r.rank);
    out[r.id] = was > 0 && now > 0 ? was - now : 0;
  }
  return out;
}

/** The snapshot to remember after a look: { [id]: rank } of every row shown (and your own). */
export function boardSnapshot(rows, me) {
  const out = {};
  for (const r of [...(rows || []), ...(me ? [me] : [])]) if (r && r.id != null && int0(r.rank) > 0) out[r.id] = int0(r.rank);
  return out;
}

/**
 * CHASE: what passes the row directly above you, in the board's order. ★ first (one more ★ than theirs passes them
 * whatever their rebirths), then rebirths (one more), then levels (one more). Returns null at #1 / nothing above;
 * else { unit: '★' | 'R' | 'LV', need, from, to, pct, target } — `from` / `to` are the two values compared,
 * `pct` 4–100 for the bar (the mockup's floor of 4 keeps the marker visible).
 */
export function chaseTarget(me, above) {
  if (!me || !above || !(int0(me.rank) > 1)) return null;
  const pick = (unit, mine, theirs) => {
    const to = theirs + 1;
    return { unit, need: Math.max(1, to - mine), from: mine, to, pct: Math.max(4, Math.min(100, Math.round((mine / to) * 100))), target: int0(above.rank) };
  };
  if (int0(above.stars) > int0(me.stars)) return pick('★', int0(me.stars), int0(above.stars));
  if (int0(above.stars) === int0(me.stars) && int0(above.rebirths) > int0(me.rebirths)) return pick('R', int0(me.rebirths), int0(above.rebirths));
  return pick('LV', lv1(me.level), lv1(above.level));
}

/**
 * CLIMB: what reaches your next v3 rank. Rebirth ranks need rebirths (R1 … R10), star ranks need ★ (★1 … ★20).
 * Returns { unit: 'R' | '★', need, from, to, pct, next: plate } or null at ENDGAME.
 */
export function climbTarget(me) {
  const st = int0(me && me.stars);
  const rb = int0(me && me.rebirths);
  const i = rankIndexV3({ rebirths: rb, stars: st });
  const nx = RANKS_V3[i + 1];
  if (!nx) return null;
  const next = rankPlate(nx.s != null ? { stars: nx.s } : { rebirths: nx.r });
  if (nx.s != null) {
    const lo = RANKS_V3[i].s != null ? RANKS_V3[i].s : 0;
    return { unit: '★', need: nx.s - st, from: st, to: nx.s, pct: Math.max(4, Math.round(((st - lo) / Math.max(1, nx.s - lo)) * 100)), next };
  }
  const lo = RANKS_V3[i].r || 0;
  return { unit: 'R', need: nx.r - rb, from: rb, to: nx.r, pct: Math.max(4, Math.round(((rb - lo) / Math.max(1, nx.r - lo)) * 100)), next };
}

/**
 * THIS WEEK gains — the JS mirror of 024_season2_weekly.sql (keep in sync; s2Board.test.js pins the SQL). A row
 * carries its stored state + the week's baseline (s2_week_stars0 / s2_week_rb0 / s2_week_lv0, stamped by the trigger
 * on the week's first change). An ascension (★ up) resets rebirths and levels, so after one this week the gains are
 * the climb since it: rebirths and levels as they stand.
 */
export function s2WeekGains(row) {
  const st = int0(row.stars);
  const st0 = int0(row.s2_week_stars0);
  const rb = int0(row.rebirths);
  const rb0 = int0(row.s2_week_rb0);
  const lv = lv1(row.level);
  const lv0 = lv1(row.s2_week_lv0);
  const weekStars = Math.max(0, st - st0);
  const weekRebirths = st > st0 ? rb : Math.max(0, rb - rb0);
  const weekLevels = st === st0 && rb === rb0 ? Math.max(0, lv - lv0) : Math.max(0, lv - 1);
  return { week_stars: weekStars, week_rebirths: weekRebirths, week_levels: weekLevels };
}

/** The THIS WEEK order (024): ★ gained → rebirths gained → levels gained → words this week. */
export function compareWeekS2(a, b) {
  return int0(b.week_stars) - int0(a.week_stars) || int0(b.week_rebirths) - int0(a.week_rebirths)
    || int0(b.week_levels) - int0(a.week_levels) || int0(b.week_words) - int0(a.week_words);
}
