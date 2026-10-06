// season2Rules.js — the JS MIRROR of 023_season2_reset.sql (PROGRESSION v3, phase 4 — THE RESET). Pure, no imports:
// the grant formula (private.season2_gems), the one-shot claim (public.lb_season2_claim), and the welcome's rolls line.
// KEEP IN SYNC with the SQL — season2Reset.test.js pins these constants against the migration text.

export const GRANT_BASE = 300; // every player
export const GRANT_PER_REBIRTH = 40; // per old (season-1) rebirth
export const GRANT_ROUND = 5; // to the NEAREST multiple of 5 (half up)
export const INT_MAX = 2147483647;
export const SEASON2_ECON = 13; // the econ a reset row (and a season-2 local save) is stamped with

export const ROLL_PRICE = 75; // gems a roll (v3 econ ROLL_PRICE)
export const EPIC_GUARANTEE_ROLLS = 50; // the welcome adds "EPIC+ GUARANTEED" from 50 rolls

/** round5: the nearest multiple of 5 (half up — SQL round() on a non-negative numeric). */
export function roundTo5(x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return GRANT_ROUND * Math.round(n / GRANT_ROUND);
}

/** gems = round5(300 + 40 × old rebirths) — R0 300, R1 340, R100 4,300 (int-clamped, like the column). */
export function season2Gems(oldRebirths) {
  const r = Number(oldRebirths);
  const rb = Number.isFinite(r) && r > 0 ? Math.floor(r) : 0;
  return Math.min(INT_MAX, roundTo5(GRANT_BASE + GRANT_PER_REBIRTH * rb));
}

/** The welcome's rolls line: "57 ROLLS · EPIC+ GUARANTEED" (≥ 50 rolls) or "4 ROLLS". `fmt` formats the count. */
export function rollsLine(gems, fmt = String) {
  const rolls = Math.floor((Number(gems) || 0) / ROLL_PRICE);
  return `${fmt(rolls)} ${rolls === 1 ? 'ROLL' : 'ROLLS'}${rolls >= EPIC_GUARANTEE_ROLLS ? ' · EPIC+ GUARANTEED' : ''}`;
}

/**
 * lb_season2_claim on a stored grant row. `grant` = { gems, rebirths, claimed_at, claim_request } | null.
 * Returns { result, grant } — `grant` is the row after the call (unchanged unless this call claimed it).
 * CHECK ORDER (as the SQL): bad id → grant row → already claimed (same id = replay, else 'claimed') → CLAIM.
 */
export function decideSeason2Claim(grant, requestId, now = Date.now()) {
  if (!requestId) return { result: { ok: false, reason: 'bad_request', gems: 0 }, grant };
  if (!grant) return { result: { ok: false, reason: 'no_grant', gems: 0 }, grant };
  if (grant.claimed_at != null) {
    if (grant.claim_request === requestId) return { result: { ok: true, gems: grant.gems, rebirths: grant.rebirths, replay: true }, grant };
    return { result: { ok: false, reason: 'claimed', gems: grant.gems }, grant };
  }
  const next = { ...grant, claimed_at: now, claim_request: requestId };
  return { result: { ok: true, gems: grant.gems, rebirths: grant.rebirths }, grant: next };
}

/** lb_season2_grant (the welcome's peek) on a stored grant row. */
export function peekSeason2Grant(grant) {
  if (!grant) return { found: false, gems: 0, rebirths: 0, claimed: false };
  return { found: true, gems: grant.gems, rebirths: grant.rebirths, claimed: grant.claimed_at != null };
}
