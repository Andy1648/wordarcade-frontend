// wheel.js — THE DAILY WHEEL (Andy oct24: "maybe next addictive direction is gacha? … a daily wheel spin (with like gems,
// boost, or guaranteed rolls, or cosmetics)"). Migration 067_daily_wheel.sql owns every result; this file is the PURE
// half (the published table, the landing angle, the reply check) + the tiny "paid" store + the one door that pays a
// landed spin into the save.
//
//   ONE free spin per LOCAL day (streak.js localDayIndex — the same day the server checks), +1 extra spin a day for a
//   rewarded ad once ads are live (WHEEL_AD_ON below AND the server's private.wheel_config.ad_on — both OFF today).
//   The SERVER rolls (lb_wheel_spin); the wheel only animates to its answer, so nothing here can pick a prize.
//
//   HONEST NEAR-MISS (claude notes wheel-research.md): the pointer ticks every peg and the wheel slows over the last
//   turn, so it crawls past whatever it passes — but it STOPS at a random point well inside the won slice (never
//   biased to the jackpot's edge), the jackpot never sits beside the most common slice, and the copy never says
//   "SO CLOSE". The odds sheet prints exactly WHEEL_SLOTS (wheel.test.js holds it to the migration's table).
//
//   STREAK: every 3rd+ day in a row is HOT (gems ×1.5), every 7th is SUPER (gems ×2, boosts 20 MIN, a ticket one tier
//   up). One missed day is forgiven. The odds never change — only what a slot pays (the server applies it).
import { localDayIndex } from './streak.js';
import { WHEEL_KEY, WHEEL_CHANGE, wheelReady } from './wheelDot.js';

export { WHEEL_KEY, WHEEL_CHANGE, wheelReady };

/** Rewarded-ad extra spin: the client half of the feature flag (AdSense H5 is not approved yet). */
export const WHEEL_AD_ON = false;

/** The published table — slot order = clockwise from 12 o'clock on public/wheel/face.webp. `w` = % (sums to 100). */
export const WHEEL_SLOTS = [
  { slot: 0, kind: 'gems', gems: 25, w: 30, label: '+25', sub: 'GEMS', icon: 'prize-gems-s', color: '#2EFFE0' },
  { slot: 1, kind: 'xp', min: 10, w: 18, label: 'XP', sub: 'BOOST', icon: 'prize-xp', color: '#FFE94A' },
  { slot: 2, kind: 'gems', gems: 60, w: 17, label: '+60', sub: 'GEMS', icon: 'prize-gems-m', color: '#2EFFE0' },
  { slot: 3, kind: 'ticket', tier: 'rare', w: 8, label: 'RARE+', sub: 'ROLL', icon: 'prize-ticket-rare', color: '#3D8BFF' },
  { slot: 4, kind: 'wins', min: 10, w: 12, label: 'WINS', sub: 'BOOST', icon: 'prize-wins', color: '#FF6B3D' },
  { slot: 5, kind: 'ticket', tier: 'legendary', w: 2, label: 'LEGEND+', sub: 'ROLL', icon: 'prize-ticket-legendary', color: '#FFC23D', jackpot: true },
  { slot: 6, kind: 'gems', gems: 120, w: 9, label: '+120', sub: 'GEMS', icon: 'prize-gems-l', color: '#9A1AFF' },
  { slot: 7, kind: 'cosmetic', w: 4, label: 'WHEEL', sub: 'COSMETIC', icon: 'prize-cosmetic', color: '#FF4FA3' },
];
export const SLICE_DEG = 360 / WHEEL_SLOTS.length;
/** The wheel-only cosmetics (kit.js wheel ids — the server picks one you have not won; both won → an EPIC+ ROLL).
 *  068_wheel_no_sidekick.sql dropped LUCKY (the SIDEKICK slot is gone). */
export const WHEEL_COSMETICS = ['jackpot', 'confetti'];
/** Retired wheel cosmetics a server still on 067 can hand out: paid as the slot's best gem prize instead (never a
 *  broken image, never a piece you can't wear). */
export const RETIRED_COSMETICS = ['lucky'];
export const RETIRED_COSMETIC_GEMS = 120;
// the FACE is face.svg: 8 exact 45° flat wedges in code-true geometry (the hero-art session: wedges can't be painted to
// register); rim / hub / pointer / prize icons are painted webps on top
export const artSrc = (name) => `/wheel/${name}.${name === 'face' || name === 'wedge-hi' ? 'svg' : 'webp'}`;

/** The odds sheet rows: what each slot pays and its chance, best first. */
export function oddsRows() {
  return WHEEL_SLOTS.slice().sort((a, b) => a.w - b.w).map((s) => ({ slot: s.slot, name: prizeName(s), pct: s.w, color: s.color }));
}
export function prizeName(s) {
  if (!s) return '';
  if (s.kind === 'gems') return `${s.gems} GEMS`;
  if (s.kind === 'xp') return `XP BOOST · ${s.min} MIN`;
  if (s.kind === 'wins') return `WINS BOOST · ${s.min} MIN`;
  if (s.kind === 'ticket') return `${s.tier === 'legendary' ? 'LEGENDARY' : 'RARE'}+ ROLL`;
  return 'WHEEL-ONLY COSMETIC';
}

/** Today's local day index (the server's p_day). */
export const wheelDay = (now = Date.now()) => localDayIndex(now);

// ---- the spin (pure) ----------------------------------------------------------------------------------------------
/**
 * The wheel's FINAL rotation (deg, clockwise) to land `slot` under the 12 o'clock pointer, from rest angle `from`.
 * At least `turns` full turns; the stop is a random point in the middle 60% of the slice (rng) — never its edge.
 */
export function landAngle(slot, from = 0, rng = Math.random, turns = 5) {
  const s = Math.max(0, Math.min(WHEEL_SLOTS.length - 1, Math.floor(Number(slot) || 0)));
  const jitter = (Math.min(0.999, Math.max(0, Number(rng()) || 0)) - 0.5) * SLICE_DEG * 0.6;
  // slot s is centred at s * SLICE_DEG clockwise; rotating the wheel by -that brings it under the pointer
  const target = ((360 - s * SLICE_DEG - jitter) % 360 + 360) % 360;
  const base = Math.ceil((from + turns * 360) / 360) * 360;
  return base + target;
}
/** Which slot sits under the pointer at rotation `deg`. */
export function slotAt(deg) {
  const a = ((-Number(deg) % 360) + 360 + SLICE_DEG / 2) % 360;
  return Math.floor(a / SLICE_DEG) % WHEEL_SLOTS.length;
}
/** The peg crossings (deg) between `from` and `to` — the pointer ticks on each (precomputed: no per-frame reads). */
export function pegCrossings(from, to) {
  const out = [];
  const first = Math.ceil((from - SLICE_DEG / 2) / SLICE_DEG) * SLICE_DEG + SLICE_DEG / 2;
  for (let a = first; a < to; a += SLICE_DEG) if (a > from) out.push(a);
  return out;
}
/** Ease-out (cubic) — the spin's curve; the same one the WAAPI animation uses, so the ticks line up. */
export const SPIN_EASE = 'cubic-bezier(0.12, 0.72, 0.16, 1)';
/** The moment (0..1 of the duration) the wheel reaches progress `p` (0..1 of the angle) under SPIN_EASE. */
export function timeAtProgress(p) {
  // invert the bezier numerically (x = time, y = progress)
  const [x1, y1, x2, y2] = [0.12, 0.72, 0.16, 1];
  const bz = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i += 1) {
    const m = (lo + hi) / 2;
    if (bz(m, y1, y2) < p) lo = m; else hi = m;
  }
  return bz((lo + hi) / 2, x1, x2);
}

// ---- THE SPIN PLAN (Andy oct25: "the scroll wheel is a bit too AI slop … unsmooth") ---------------------------------
// ONE continuous WAAPI rotate in two keyframe legs on ONE timeline: a long friction DECEL (fast launch, the last turn a
// crawl) that runs a hair PAST the landing point, then the flapper nudges it back to rest (velocity is zero at the
// joint, so there is no visible seam and no snap). The pointer + the tick sound read the SAME timeline each frame via
// spinAngleAt() — pure math off anim.currentTime, never a timer and never a layout read.
export const SPIN_MS = 5600;
export const SPIN_DECEL = [0.2, 0.62, 0.15, 1]; // launch slope ~3.1x the average speed; the tail eases to a dead stop
export const SPIN_SETTLE = [0.42, 0, 0.36, 1];
const SETTLE_AT = 0.9; // the decel leg's share of the duration
const bez = ([a, b, c, d]) => `cubic-bezier(${a}, ${b}, ${c}, ${d})`;
/** A CSS cubic-bezier evaluated at time-fraction x (0..1) → progress (0..1). Bisection on the x curve. */
export function bezierAt([x1, y1, x2, y2], x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const f = (t, p, q) => 3 * p * t * (1 - t) ** 2 + 3 * q * t * t * (1 - t) + t ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 26; i += 1) {
    const m = (lo + hi) / 2;
    if (f(m, x1, x2) < x) lo = m; else hi = m;
  }
  return f((lo + hi) / 2, y1, y2);
}
/** The spin from `start` to the landing angle `to` (deg): { keyframes, ms, over, angleAt(ms) }. The overshoot stops
 *  ≥ 2° short of the next peg, so it never crosses into the next slot (the result never changes after it shows). */
export function spinPlan(start, to, ms = SPIN_MS) {
  const nextPeg = pegCrossings(to, to + SLICE_DEG)[0] ?? to + SLICE_DEG;
  const over = Math.max(0, Math.min(3, nextPeg - to - 2));
  const peak = to + over;
  const keyframes = [
    { transform: `rotate(${start}deg)`, easing: bez(SPIN_DECEL) },
    { transform: `rotate(${peak}deg)`, offset: SETTLE_AT, easing: bez(SPIN_SETTLE) },
    { transform: `rotate(${to}deg)` },
  ];
  const angleAt = (t) => {
    const x = Math.max(0, Math.min(1, t / ms));
    if (x <= SETTLE_AT) return start + (peak - start) * bezierAt(SPIN_DECEL, x / SETTLE_AT);
    return peak + (to - peak) * bezierAt(SPIN_SETTLE, (x - SETTLE_AT) / (1 - SETTLE_AT));
  };
  return { keyframes, ms, over, peak, angleAt };
}
/** How many pegs have passed the pointer at angle `deg` (a step function: the tick fires when it goes up). */
export const pegsPast = (deg) => Math.floor((deg - SLICE_DEG / 2) / SLICE_DEG);
/** THE FLAPPER: its deflection (deg, ≥ 0) one frame on — pushed up by the approaching peg over the last `zone` of each
 *  slice, released at the crossing, then it springs home (exponential, τ ms). At speed it never gets home before the
 *  next peg, so it flutters high — the way a real flapper does — instead of strobing. */
export function flapperStep(prev, deg, dtMs, crossed, { max = 26, zone = 0.3, tau = 55 } = {}) {
  const ph = (((deg - SLICE_DEG / 2) / SLICE_DEG) % 1 + 1) % 1; // 0 = just past a peg, → 1 = the next peg arriving
  const push = ph > 1 - zone ? (max * (ph - (1 - zone))) / zone : 0;
  const home = (crossed ? max : prev) * Math.exp(-Math.max(0, dtMs) / tau);
  return Math.max(push, home);
}

/** THE FLAPPER TRACK for a spinPlan: the whole flapper motion baked into ONE keyframe list (sampled at `fps` off the
 *  same angleAt the rotor rides) + every peg crossing's moment (ms). The pointer then runs as a single composited WAAPI
 *  animation started with the rotor, and the ticks are scheduled on the AUDIO clock — nothing is driven by a timer or a
 *  main-thread frame, so a busy page can't make the flapper hitch or a click land late. */
export function flapperTrack(plan, fps = 60) {
  const n = Math.max(2, Math.round((plan.ms / 1000) * fps));
  const frames = [];
  let defl = 0;
  let pegs = pegsPast(plan.angleAt(0));
  for (let i = 0; i <= n; i += 1) {
    const t = (plan.ms * i) / n;
    const deg = plan.angleAt(t);
    const now = pegsPast(deg);
    defl = flapperStep(defl, deg, plan.ms / n, now > pegs);
    pegs = now;
    frames.push({ transform: `rotate(${-defl.toFixed(2)}deg)`, offset: +(i / n).toFixed(5) });
  }
  frames[frames.length - 1] = { transform: 'rotate(0deg)', offset: 1 };
  // each peg's exact moment: bisect the (monotonic until the peak) angle curve
  const ticks = [];
  const tPeak = plan.ms * 0.9;
  for (const peg of pegCrossings(plan.angleAt(0), plan.peak)) {
    let lo = 0;
    let hi = tPeak;
    for (let k = 0; k < 30; k += 1) {
      const m = (lo + hi) / 2;
      if (plan.angleAt(m) < peg) lo = m; else hi = m;
    }
    ticks.push(Math.round(hi));
  }
  return { frames, ticks };
}

// ---- the server's reply -------------------------------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIERS = ['rare', 'epic', 'legendary', 'mythic'];
/** A lb_wheel_spin / lb_wheel_state spin → { spin, day, kind, slot, prize, amount, ticket, cosmetic, streak, bonus,
 *  claimed, again } or null when anything is off (a broken reply never pays). */
export function normalizeSpin(r) {
  if (!r || r.ok !== true || !UUID.test(String(r.spin))) return null;
  const slot = Number(r.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot >= WHEEL_SLOTS.length) return null;
  const prize = String(r.prize || '');
  if (!['gems', 'xp', 'wins', 'ticket', 'cosmetic'].includes(prize)) return null;
  if (prize === 'cosmetic' && RETIRED_COSMETICS.includes(r.cosmetic)) {
    return normalizeSpin({ ...r, prize: 'gems', amount: RETIRED_COSMETIC_GEMS, cosmetic: null });
  }
  const amount = Math.max(0, Math.floor(Number(r.amount) || 0));
  if (prize === 'gems' && (amount < 1 || amount > 1000)) return null;
  if ((prize === 'xp' || prize === 'wins') && (amount < 1 || amount > 60)) return null;
  const t = r.ticket && UUID.test(String(r.ticket.id)) && TIERS.includes(r.ticket.tier) ? { id: String(r.ticket.id), tier: r.ticket.tier } : null;
  if (prize === 'ticket' && !t) return null;
  const cosmetic = prize === 'cosmetic' && WHEEL_COSMETICS.includes(r.cosmetic) ? r.cosmetic : null;
  if (prize === 'cosmetic' && !cosmetic) return null;
  return {
    spin: String(r.spin), day: Number(r.day) || 0, kind: r.kind === 'ad' ? 'ad' : 'free', slot, prize, amount,
    ticket: t, cosmetic, streak: Math.max(0, Math.floor(Number(r.streak) || 0)),
    bonus: r.bonus === 'hot' || r.bonus === 'super' ? r.bonus : null, claimed: r.claimed === true, again: r.again === true,
  };
}
/** The result line ("+50 GEMS", "LEGENDARY+ ROLL", …) for a normalized spin. */
export function resultText(s) {
  if (!s) return '';
  if (s.prize === 'gems') return `+${s.amount} GEMS`;
  if (s.prize === 'xp') return `XP BOOST · ${s.amount} MIN`;
  if (s.prize === 'wins') return `WINS BOOST · ${s.amount} MIN`;
  if (s.prize === 'ticket') return `${s.ticket.tier.toUpperCase()}+ ROLL`;
  return 'NEW COSMETIC';
}
export const bonusText = (b) => (b === 'super' ? 'SUPER SPIN · ×2' : b === 'hot' ? 'HOT STREAK · ×1.5' : '');
/** What tomorrow's streak bonus will be, from today's streak count. */
export function nextBonus(streak) {
  const n = Math.max(0, Math.floor(Number(streak) || 0)) + 1;
  return n % 7 === 0 ? 'super' : n >= 3 ? 'hot' : null;
}

// ---- the paid store (a spin pays into THIS save once) -------------------------------------------------------------
export function readWheel() {
  try {
    const o = JSON.parse(localStorage.getItem(WHEEL_KEY) || 'null');
    return {
      paid: Array.isArray(o && o.paid) ? o.paid.filter((x) => UUID.test(String(x))) : [],
      day: Number.isInteger(o && o.day) ? o.day : 0,
      streak: Number.isInteger(o && o.streak) ? o.streak : 0,
    };
  } catch {
    return { paid: [], day: 0, streak: 0 };
  }
}
function writeWheel(o) {
  try { localStorage.setItem(WHEEL_KEY, JSON.stringify(o)); } catch { return false; }
  try { window.dispatchEvent(new Event(WHEEL_CHANGE)); } catch { /* node */ }
  return true;
}
/** Remember today's free spin happened (the menu dot reads this before the server answers). */
export function noteSpun(day, streak) {
  const w = readWheel();
  return writeWheel({ ...w, day: Math.max(w.day, day), streak: Number.isInteger(streak) ? streak : w.streak });
}

/**
 * Pay a LANDED spin into the save, once (`deps` = { grantGems, grantFx, grantKit } — the lazy panel passes the real
 * doors so this module stays a leaf). Tickets are already on the server. Returns true when it paid now.
 */
export function payLanded(s, deps) {
  if (!s || s.claimed) return false;
  const w = readWheel();
  if (w.paid.includes(s.spin)) return false;
  // paid is written FIRST: a failed write never pays, a second call never pays twice
  if (!writeWheel({ ...w, paid: [...w.paid, s.spin].slice(-20) })) return false;
  try {
    if (s.prize === 'gems') deps.grantGems(s.amount, 'wheel', { detail: 'daily wheel' });
    else if (s.prize === 'xp' || s.prize === 'wins') deps.grantFx(s.prize, s.amount);
    else if (s.prize === 'cosmetic') deps.grantKit(s.cosmetic);
  } catch { /* a door that throws must not break the reveal */ }
  return true;
}
