// claims.js — REWARDS YOU CLAIM (Andy oct2: "Wins only come from playing games. Anything else
// (achievements, titles, badges, rank-ups) must be CLAIMED by the player via a popup or by
// clicking it, with a notification icon until claimed.")
//
// Before this, an achievement, a collection milestone or the welcome-back bonus credited the
// balance the instant it was earned — on menu mount, mid-run — and the player's number moved
// without them doing anything. Now those sources QUEUE a claim here instead; the wins only move
// when the player presses CLAIM (ClaimsPanel / ClaimPopup), through the same labelled door
// (wins.js grantWins) every bonus already used, so the ledger, the toast and the no-hidden-wins
// sum are unchanged.
//
// What stays automatic: money earned BY PLAYING — per-word payouts, the mastery milestone and the
// FUSE FRENZY bonus (both land mid-run and are itemised on that run's receipt), and in-game word
// secrets.
//
// The amount is FIXED when the claim is queued (it was earned then, at that rebirth multiplier);
// claiming later neither grows nor shrinks it. Claims survive rebirth (their own key).
//
// PURE + guarded store, like every progress module: blocked storage → claims are granted on the
// spot instead (never lost, never throws).
import { grantWins } from './wins.js';

export const CLAIMS_KEY = 'taw.claims';
const MAX_CLAIMS = 200; // a bound on a corrupt/huge save, not a design limit

/** kind → the label the panel files it under. */
export const CLAIM_KINDS = {
  achievement: 'ACHIEVEMENT',
  collection: 'COLLECTION',
  welcome: 'WELCOME BACK',
  rank: 'RANK UP',
  mark: 'NEW MARK',
  layer: 'NEW SYSTEM',
  code: 'CODE',
};

// Per-kind side effects of claiming (a NEW MARK becomes owned, …). Registered by the owning module.
// A hoisted function holds the map: marks.js registers while this module may still be mid-evaluation
// (claims → wins → marks → claims), when a module-level `const` would not exist yet.
function handlerStore() {
  if (!handlerStore.map) handlerStore.map = new Map();
  return handlerStore.map;
}
export function registerClaimHandler(kind, fn) {
  if (kind && typeof fn === 'function') handlerStore().set(kind, fn);
}
function runHandler(c) {
  const h = handlerStore().get(c.kind);
  if (!h) return;
  try {
    h(c);
  } catch {
    /* a handler must never lose the claim's money */
  }
}

const listeners = new Set();
function emit() {
  for (const fn of listeners) {
    try {
      fn(listClaims());
    } catch {
      /* a listener must never break a claim */
    }
  }
}
/** Subscribe to the pending list; returns an unsubscribe. */
export function subscribeClaims(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function load() {
  try {
    const raw = localStorage.getItem(CLAIMS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((c) => c && typeof c.id === 'string') : [];
  } catch {
    return [];
  }
}
function save(arr) {
  try {
    localStorage.setItem(CLAIMS_KEY, JSON.stringify(arr.slice(-MAX_CLAIMS)));
    return true;
  } catch {
    return false;
  }
}

/** Every pending claim, oldest first. */
export function listClaims() {
  return load();
}
export function pendingCount() {
  return load().length;
}

/**
 * Queue a reward for the player to claim. `id` makes it idempotent (an achievement can only be
 * queued once). `amount` may be 0 for a claim that unlocks something rather than paying (a new
 * mark, a new system). Returns the queued claim, or null if that id is already pending.
 */
export function queueClaim({ id, kind, label, amount = 0, detail, meta } = {}) {
  if (!id || !kind) return null;
  const arr = load();
  if (arr.some((c) => c.id === id)) return null;
  const claim = {
    id,
    kind,
    label: label || CLAIM_KINDS[kind] || 'REWARD',
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0,
    detail: detail || null,
    meta: meta || null,
    ts: Date.now(),
  };
  arr.push(claim);
  if (!save(arr)) {
    // Storage blocked: the reward still reaches the player (the old behaviour), just unclaimed.
    if (claim.amount > 0) grantWins(claim.amount, claim.label, { detail: claim.detail || claim.id });
    return null;
  }
  emit();
  return claim;
}

/** Claim one: pays it (if it pays) through the labelled door and removes it. Returns it or null. */
export function claim(id) {
  const arr = load();
  const i = arr.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const [c] = arr.splice(i, 1);
  save(arr);
  if (c.amount > 0) grantWins(c.amount, c.label, { detail: c.detail || c.id, claimed: true });
  runHandler(c);
  emit();
  return c;
}

/** Claim everything pending. Returns { count, wins }. */
export function claimAll() {
  const arr = load();
  let wins = 0;
  for (const c of arr) {
    runHandler(c);
    if (c.amount > 0) {
      grantWins(c.amount, c.label, { detail: c.detail || c.id, claimed: true });
      wins += c.amount;
    }
  }
  save([]);
  emit();
  return { count: arr.length, wins };
}

// ---- NEW SYSTEM layers (STEP 49 reveal moments) -------------------------------------------------
// A 'layer' claim's `detail` names the system; claiming it OPENS that system for good.
const LAYER_KEY = (detail) => `taw.layer.${detail}`;
registerClaimHandler('layer', (c) => {
  try {
    if (c && c.detail) localStorage.setItem(LAYER_KEY(c.detail), '1');
  } catch {
    /* blocked */
  }
});
/** Has the player claimed (opened) this system? */
export function layerOpen(detail) {
  try {
    return localStorage.getItem(LAYER_KEY(detail)) === '1';
  } catch {
    return true; // blocked storage: never hide a system the player cannot unlock
  }
}
export function openLayer(detail) {
  try {
    localStorage.setItem(LAYER_KEY(detail), '1');
  } catch {
    /* blocked */
  }
}
