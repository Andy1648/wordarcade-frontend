// returnBonus.js — the WELCOME BACK grant. Idle games pay offline income; a typing game
// shouldn't (you weren't typing), but zero acknowledgement of an absence is also cold — and paying
// a FLAT amount for every absence (the old min(hoursAway,12)×100 cap: 12h, 1 day and 2 weeks all
// paid an identical 1,200 and read "12+ HOURS AWAY") never makes a long-absent player feel seen.
//
// So the grant now SCALES with time away, up to a bounded ceiling:
//   • the first 12h accrue 100 wins/hr, exactly as before (6h → 600, 12h → 1,200);
//   • beyond 12h a SATURATING long-absence bonus is added (hyperbolic, asymptotic to +280),
//     so a longer lapse pays a little more — but never rivals active play. The whole grant is
//     hard-capped at MAX_RETURN_WINS (1,480 at R0), well under 25% of a typical session (~6,000
//     wins), so returning can never out-earn showing up and playing. Granted at most once per
//     CALENDAR DAY. See returnbonus-report.md.
//
// PURE given (lastSeenMs, now): the caller captures lastSeenMs at module load BEFORE the app
// re-stamps wa_last_seen. Guarded store, never throws.
import { grantWins } from './wins.js';
import { rebirthMult, getRebirths, round10 } from './xp.js';

export const RETURN_CLAIM_KEY = 'taw.returnClaim'; // the calendar day (local date string) last claimed
export const MIN_AWAY_HOURS = 6;
export const RAMP_HOURS = 12; // hours over which the base grant accrues at PER_HOUR_WINS
export const PER_HOUR_WINS = 100;
export const BASE_MAX = RAMP_HOURS * PER_HOUR_WINS; // 1,200 — the base once you cross the ramp
export const LONG_BONUS_MAX = 280; // asymptotic ceiling of the extra long-absence bonus
export const LONG_SAT_DAYS = 2; // days-beyond-ramp at which the long bonus reaches half of its max
export const MAX_RETURN_WINS = BASE_MAX + LONG_BONUS_MAX; // 1,480 at R0 — the hard ceiling
// CAP_HOURS kept as an alias for the ramp so older callers/tests importing it still read a sane
// value (the point past which the base hourly accrual stops); the grant no longer flat-caps here.
export const CAP_HOURS = RAMP_HOURS;

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

// The wins a return of `hoursAway` would pay right now (× the live rebirth mult). PURE.
// Curve at R0: 6h→600, 12h→1,200, 1d→1,260, 3d→1,360, 7d→1,410, 14d→1,440, →1,480 (ceiling).
export function returnBonusWins(hoursAway, rebirthCount = getRebirths()) {
  const h = Number.isFinite(hoursAway) && hoursAway > 0 ? hoursAway : 0;
  if (h < MIN_AWAY_HOURS) return 0;
  const base = Math.min(h, RAMP_HOURS) * PER_HOUR_WINS; // 600..1,200 over the first 12h
  let longBonus = 0;
  if (h > RAMP_HOURS) {
    const daysBeyond = (h - RAMP_HOURS) / 24; // days past the 12h ramp
    longBonus = (LONG_BONUS_MAX * daysBeyond) / (daysBeyond + LONG_SAT_DAYS); // saturating, < LONG_BONUS_MAX
  }
  const rawR0 = Math.min(base + longBonus, MAX_RETURN_WINS); // bounded before rebirth scaling
  return round10(rawR0 * rebirthMult(rebirthCount));
}

// A short, warm label for how long the player was gone: "8 HOURS" / "1 DAY" / "3 DAYS" /
// "2 WEEKS" / "3 MONTHS". PURE — the card composes the full sentence around it. Coarsens as the
// absence grows so a two-week lapse never reads as "336 HOURS".
export function absenceLabel(hoursAway) {
  const h = Number.isFinite(hoursAway) && hoursAway > 0 ? hoursAway : 0;
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 'S'}`;
  if (h < 24) return plural(Math.max(1, Math.round(h)), 'HOUR');
  const days = Math.floor(h / 24);
  if (days < 14) return plural(days, 'DAY');
  if (days < 60) return plural(Math.floor(days / 7), 'WEEK');
  return plural(Math.floor(days / 30), 'MONTH');
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
// { granted, wins, hoursAway } — hoursAway is the REAL (uncapped) absence so the card can say how
// long you were actually gone. Returns null if not eligible. Call ONCE on menu mount with the
// last-seen time captured at module load.
export function claimReturnBonus(lastSeenMs, now = Date.now()) {
  const p = pendingReturnBonus(lastSeenMs, now);
  if (!p.eligible) return null;
  grantWins(p.wins);
  markClaimed(now);
  return { granted: true, wins: p.wins, hoursAway: p.hoursAway };
}
