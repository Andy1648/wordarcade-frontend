// satRush/config.js
// Master on/off switch for the whole SAT RUSH mode. Everything the mode
// adds — the menu card, the route, the engine — is gated on this one flag so
// the mode stays completely dark until it ships.
//
// Same idiom as PORTAL_SKIP_INTRO / LAUNCH_INTENT in App.jsx: a value resolved
// ONCE at module load from build-time env + a query-string escape hatch.
//   - `SHIP_DEFAULT` is the ship switch. It stays `false` through development
//     and is flipped to `true` in the final build step (see the build order).
//   - `VITE_SAT_RUSH=1` force-enables it for a preview build.
//   - `?satRush=1` force-enables it for a single browser session, so the
//     mode can be play-tested locally while the ship default is still off.
// With all three off (the current shipped state) nothing renders and no card
// appears on the menu.

const SHIP_DEFAULT = true;

export const SAT_RUSH_ENABLED =
  SHIP_DEFAULT ||
  import.meta.env.VITE_SAT_RUSH === '1' ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('satRush') === '1');

// The view id the mode mounts under (App.jsx routes on this) and the word
// flashed mid-wipe when navigating in, kept next to the flag so the whole
// mode's wiring lives in one place.
export const SAT_RUSH_VIEW = 'sat-rush';
export const SAT_RUSH_TRANSITION_WORD = 'SHARPEN UP';

// Mode accent — INK. SAT RUSH is a duotone manga surface (ink #111 + paper
// #F0EAD9 + screentone); there is no spot colour. Kept as a named export so the
// route background / share card stay on-palette.
export const SAT_RUSH_COLOR = '#111111';

// Dev-only stage-interval override. The 3-stage model uses longer beats (2800ms),
// exposed the SAME way as the flag above — a query-string escape hatch resolved
// once at module load. `?stage=1200` sets the starting per-stage reveal interval
// (clamped to a sane range). Default is 2800. The upper clamp is 12000 so LINEUP
// (which needs a slower base + its own multiplier) can actually be slowed down —
// the old 3000 ceiling made that impossible.
export const DEFAULT_STAGE_MS = 2800;

// ---- PER-CARD STAGE LENGTH (fix/sat-ante-fairness) --------------------------------------
// The ante ladder (5/3/1 over three beats) used to charge every card the SAME time budget, so
// AVG ANTE measured reading speed rather than vocabulary: a 196-char context made x5 unreachable
// however well you knew the word. The beat now scales with what the card actually asks you to
// read, using the costMs baked into words.json at build time (scripts/build-sat-costs.mjs).
//
// Three beats and the 5/3/1 multipliers are UNCHANGED, so the scoring model and the meaning of
// AVG ANTE are exactly as before — only the length of a beat moves.
export const STAGE_COST_FACTOR = 0.85;
export const STAGE_MS_MIN = 2200;
export const STAGE_MS_MAX = 9000;

/**
 * The base stage length for one card. `card.costMs` is the build-time read+type estimate; a card
 * with no costMs (a test fixture, or data built before this field existed) falls back to the flat
 * default, so nothing can crash on missing data.
 *
 * THE CONSTANTS, and what they cost. 0.85 / 9000 is tuned for the MEDIAN player (200wpm read,
 * 35wpm type): they clear 74.6% of cards at x5. The first pass shipped 0.42 / 5200, which put
 * that same player at 0% — the beat was a fraction of the card's own cost, so nobody could finish
 * inside one beat.
 *
 * Two things this tuning canNOT do, both measured in src/satRush/anteFairness.test.js:
 *   - A SLOW player (160wpm/25wpm) still clears only 0.5% at x5, and a FAST one (260wpm/55wpm)
 *     clears 99.8%. No factor/ceiling pair fixes both: slow players' p25 stage-0 cost (8250ms) is
 *     ABOVE fast players' p95 (7628ms), so the two distributions do not overlap. Any beat generous
 *     enough to give slow players a quarter of the x5s hands fast players essentially all of them.
 *   - Four of the longest cards get a beat under 60% of their own cost, because the 9000ms ceiling
 *     bites before the factor does. A ceiling of 9562+ removes that, at the cost of pushing the
 *     median player to 82% (outside the intended band).
 */
export function stageMs(card) {
  const cost = card && Number.isFinite(card.costMs) ? card.costMs : null;
  if (cost == null) return DEFAULT_STAGE_MS;
  return Math.min(STAGE_MS_MAX, Math.max(STAGE_MS_MIN, Math.round(cost * STAGE_COST_FACTOR)));
}
export const SAT_RUSH_STAGE_MS = (() => {
  if (typeof window === 'undefined') return DEFAULT_STAGE_MS;
  const raw = new URLSearchParams(window.location.search).get('stage');
  const ms = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(ms)) return DEFAULT_STAGE_MS;
  return Math.min(12000, Math.max(400, Math.round(ms)));
})();

// Dev-only LINEUP stage-cadence multiplier override, same idiom as ?stage=.
// LINEUP's stages need MORE reading time (a fresh sentence + six unknown suspect
// words to scan each beat) than briefing's recall-after-study, so its stage
// cadence gets its own multiplier ON TOP of the base. `?lineupx=2.5` sets it for
// a single session (clamped 0.5–5). Default 3.0, mirroring engine.js
// DEFAULT_CONFIG.lineupStageScale.
export const DEFAULT_LINEUP_SCALE = 3.0;
export const SAT_RUSH_LINEUP_SCALE = (() => {
  if (typeof window === 'undefined') return DEFAULT_LINEUP_SCALE;
  const raw = new URLSearchParams(window.location.search).get('lineupx');
  const x = raw == null ? NaN : Number(raw);
  if (!Number.isFinite(x)) return DEFAULT_LINEUP_SCALE;
  return Math.min(5, Math.max(0.5, x));
})();

// Show the live dev tuner (a slider panel for tuning the stage interval against
// a real build without reloading). On in Vite dev, or force with `?tune=1`.
export const SAT_RUSH_DEV_TUNER =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('tune') === '1');

// Dev/QA scene deep-link: `?scene=deep|revenant|silver|normal` jumps straight
// into that state on load (for tuning / QA / screenshots) and hides the tuner so
// the shot is clean. Honoured only alongside the dev tuner flag.
export const SAT_RUSH_SCENE = (() => {
  if (typeof window === 'undefined') return null;
  const s = new URLSearchParams(window.location.search).get('scene');
  return ['normal', 'deep', 'revenant', 'silver', 'results'].includes(s) ? s : null;
})();

// Dev/QA: `?freeze=1` pauses the stage clock so a scene holds still (for stable
// screenshots). No effect without the dev tuner flag.
export const SAT_RUSH_FREEZE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('freeze') === '1';

// Dev/QA: `?lock=N` locks the first N letters of the scene word (mid-word shot).
export const SAT_RUSH_LOCK = (() => {
  if (typeof window === 'undefined') return 0;
  const n = parseInt(new URLSearchParams(window.location.search).get('lock'), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : 0;
})();
