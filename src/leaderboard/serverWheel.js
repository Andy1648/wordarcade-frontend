// serverWheel.js — THE DAILY WHEEL, the server half (migration 067_daily_wheel.sql). The server rolls every spin; this
// module only asks for it, and never stores a result of its own (the "paid" list lives in progress/wheel.js).
//
//   wheelState()       lb_wheel_state → { streak, adOn, free, ad } (free / ad = today's spin, normalized, or null)
//   spinWheel(kind)    lb_wheel_spin  → today's spin of `kind` ('free' | 'ad'): the SAME one on every later ask
//   claimWheel(id)     lb_wheel_claim after the reveal landed and the save was paid
// Unavailable (no name, offline, season 1, pre-067): { off: true } / null — the wheel says it can't spin right now.
import { getSecret, rpc } from './client.js';
import { serverRollOn } from './serverRoll.js';
import { normalizeSpin, wheelDay } from '../progress/wheel.js';

let off = false; // lb_wheel_* is not there (pre-067): stop asking this page load
const missing = (e) => /lb_wheel|PGRST202|http_404|Could not find the function/i.test(String((e && e.code) || (e && e.message) || ''));

/** Can this player spin right now? (a named season-2 player, online, 067 present) */
export const wheelOn = () => !off && serverRollOn();

export async function wheelState(now = Date.now()) {
  if (!wheelOn()) return { off: true };
  try {
    const r = await rpc('lb_wheel_state', { p_secret: getSecret(), p_day: wheelDay(now) });
    if (!r || r.ok !== true) return { off: true };
    return {
      off: false,
      streak: Math.max(0, Math.floor(Number(r.streak) || 0)),
      lastDay: Math.max(0, Math.floor(Number(r.last_day) || 0)),
      adOn: r.ad_on === true,
      free: r.free ? normalizeSpin(r.free) : null,
      ad: r.ad ? normalizeSpin(r.ad) : null,
    };
  } catch (e) {
    if (missing(e)) off = true;
    return { off: true };
  }
}

/** Resolves { spin } (normalized) or { error: 'spun' | 'ads_off' | 'free_first' | 'day' | 'off' }. */
export async function spinWheel(kind = 'free', now = Date.now()) {
  if (!wheelOn()) return { error: 'off' };
  try {
    const r = await rpc('lb_wheel_spin', { p_secret: getSecret(), p_day: wheelDay(now), p_kind: kind });
    const s = normalizeSpin(r);
    if (s) return { spin: s };
    return { error: (r && r.reason) || 'off' };
  } catch (e) {
    if (missing(e)) off = true;
    return { error: 'off' };
  }
}

export async function claimWheel(id) {
  if (!id || !wheelOn()) return false;
  try {
    const r = await rpc('lb_wheel_claim', { p_secret: getSecret(), p_spin: id });
    return !!(r && r.ok);
  } catch {
    return false;
  }
}
