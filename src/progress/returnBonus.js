// returnBonus.js — the WELCOME BACK grant (Job 6). Idle games pay offline income; a typing game
// shouldn't (you weren't typing), but zero acknowledgement of an absence is also cold. So: on
// returning after >= 6 hours away, a one-time grant of min(hoursAway, 12) × 100 × rebirthMult wins,
// at most once per CALENDAR DAY. It deliberately never rivals active play (see returnbonus-report.md).
//
// PURE given (lastSeenMs, now): the caller captures lastSeenMs at module load BEFORE the app
// re-stamps wa_last_seen. Guarded store, never throws.
import { grantWins } from './wins.js';
import { rebirthMult, getRebirths } from './xp.js';

export const RETURN_CLAIM_KEY = 'taw.returnClaim'; // the calendar day (local date string) last claimed
export const MIN_AWAY_HOURS = 6;
export const CAP_HOURS = 12;
export const PER_HOUR_WINS = 100;

const HOUR_MS = 3600000;

function localDayKey(now) {
  try {
    return new Date(now).toDateString(); // local calendar day, e.g. "Thu Aug 28 2026"
  } catch {
    return '';
  }
}
function claimedDay() {
  try {
    return localStorage.getItem(RETURN_CLAIM_KEY) || '';
  } catch {
    return '';
  }
}
function markClaimed(now) {
  try {
    localStorage.setItem(RETURN_CLAIM_KEY, localDayKey(now));
  } catch {
    /* storage blocked — worst case the grant can re-fire once; guarded elsewhere by the away gate */
  }
}

// The wins a return of `hoursAway` would pay right now (× the live rebirth mult). Pure-ish.
export function returnBonusWins(hoursAway, rebirthCount = getRebirths()) {
  const h = Number.isFinite(hoursAway) && hoursAway > 0 ? Math.min(hoursAway, CAP_HOURS) : 0;
  if (h < MIN_AWAY_HOURS) return 0;
  return Math.round(h * PER_HOUR_WINS * rebirthMult(rebirthCount));
}

// Compute (without granting) whether a return bonus is due, given the captured last-seen time.
export function pendingReturnBonus(lastSeenMs, now = Date.now()) {
  if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) return { eligible: false, hoursAway: 0, wins: 0 };
  const hoursAway = (now - lastSeenMs) / HOUR_MS;
  const alreadyToday = claimedDay() === localDayKey(now);
  const wins = returnBonusWins(hoursAway);
  const eligible = hoursAway >= MIN_AWAY_HOURS && !alreadyToday && wins > 0;
  return { eligible, hoursAway, wins };
}

// Claim the return bonus if due: grants the wins, marks today claimed, and returns
// { granted, wins, hoursAway } — or null if not eligible. Call ONCE on menu mount with the
// last-seen time captured at module load.
export function claimReturnBonus(lastSeenMs, now = Date.now()) {
  const p = pendingReturnBonus(lastSeenMs, now);
  if (!p.eligible) return null;
  grantWins(p.wins);
  markClaimed(now);
  return { granted: true, wins: p.wins, hoursAway: Math.min(p.hoursAway, CAP_HOURS) };
}
