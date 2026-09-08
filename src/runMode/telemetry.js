// telemetry.js — THE RUN's two product-analytics events (feat/run-telemetry):
//   run_round — one per round END: how the round went vs the wall.
//   run_over  — one per run END: how far the run got and what it paid.
// PURE payload builders (unit-tested in telemetry.test.js — no imports, so node:test loads them
// without the posthog/Sentry modules) plus thin emitters that take the TRACKER as an argument. The
// hook passes lib/analytics `track` — the same fire-and-forget PostHog client every other mode uses:
// no key / no client → silent no-op, and the emitters swallow anything so nothing reaches gameplay.
//
// PRIVACY: enums, ids and counts only. `accepted` / `attempts` are COUNTS — never the typed words.
// `mode` is the rolled round mode ('chain' | 'fuse' | 'sat'); `stackIds` are modifier ids.

export const RUN_ROUND_EVENT = 'run_round';
export const RUN_OVER_EVENT = 'run_over';
export const RUN_OVER_REASONS = ['wall', 'fumble', 'cleared'];

const int = (x) => (Number.isFinite(x) ? Math.round(x) : 0);

// { round, mode, seed, wall, accepted, attempts, rawScore, adjustedScore, cleared, stackIds, secondsLeft }
export function runRoundPayload(f = {}) {
  return {
    round: int(f.round),
    mode: typeof f.mode === 'string' && f.mode ? f.mode : 'unknown',
    seed: Number.isFinite(f.seed) ? f.seed >>> 0 : null,
    wall: int(f.wall),
    accepted: int(f.accepted),
    attempts: int(f.attempts),
    rawScore: int(f.rawScore), // the raw per-word sum (a float in play) — rounded like the meter
    adjustedScore: int(f.adjustedScore), // after round-level modifiers: what the wall was compared to
    cleared: !!f.cleared,
    stackIds: Array.isArray(f.stackIds) ? f.stackIds.filter((s) => typeof s === 'string') : [],
    secondsLeft: Math.max(0, int(f.secondsLeft)),
  };
}

// { roundReached, reason, cumulative, winsEarned, level }
export function runOverPayload(f = {}) {
  return {
    roundReached: int(f.roundReached),
    reason: RUN_OVER_REASONS.includes(f.reason) ? f.reason : 'unknown',
    cumulative: int(f.cumulative),
    winsEarned: int(f.winsEarned),
    level: Math.max(1, int(f.level)),
  };
}

// Emitters: build the payload and hand it to `tracker(event, props)`. A missing tracker is a no-op;
// a throwing tracker is swallowed (analytics may never bubble into a round).
export function emitRunRound(fields, tracker) {
  try {
    if (typeof tracker === 'function') tracker(RUN_ROUND_EVENT, runRoundPayload(fields));
  } catch { /* analytics only */ }
}
export function emitRunOver(fields, tracker) {
  try {
    if (typeof tracker === 'function') tracker(RUN_OVER_EVENT, runOverPayload(fields));
  } catch { /* analytics only */ }
}
