// payClient.js — the browser half of PAID GEMS (LAZY: only loaded when payments/flag.js says ON).
//   startCheckout(packId)  POST /api/checkout { pack, secret, access } -> redirect to Stripe Checkout. NEVER an amount.
//                          access = the SIGN IN WITH GOOGLE session (085: buying needs one; no session -> 'sign_in').
//   fetchPaid()            082 pay_gems_pending: the paid-gem ledger rows this browser has not applied yet, plus this
//                          month's spend and cap (the shelf's "left this month" line).
//   applyPaid(rows)        applies each row ONCE (the ids are remembered in taw.pay.applied, so a lost ack can never pay
//                          twice): +N through the one gem door (grantGems 'paid'), −N off the balance FLOORED AT 0
//                          (082's header: the server budget keeps the rest of the debt), then acks them to the server.
//   collectPaid(opts)      fetch + apply, optionally polling (the return from Stripe: the webhook can land a few seconds
//                          after the redirect). onCredit(total) fires BEFORE the gems are granted, so the menu's pill
//                          can hold them for the fly-in.
import { LEADERBOARD_ENABLED, peekSecret, getMyProfile, rpc } from '../leaderboard/client.js';
import { grantGems, loadGemState, saveGemState, tellBalance } from '../progress/gemsCore.js';

const APPLIED_KEY = 'taw.pay.applied';
const APPLIED_MAX = 300;

function readApplied() {
  try {
    const a = JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]');
    return Array.isArray(a) ? a.filter((x) => Number.isFinite(x)) : [];
  } catch {
    return [];
  }
}
function writeApplied(ids) {
  try { localStorage.setItem(APPLIED_KEY, JSON.stringify(ids.slice(-APPLIED_MAX))); } catch { /* storage blocked */ }
}

/** Take `n` gems off, never below 0. -> the gems actually removed. */
export function clawGems(n) {
  const amt = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  if (!amt) return 0;
  const s = loadGemState();
  const took = Math.min(s.bal, amt);
  s.bal -= took;
  saveGemState(s);
  tellBalance(s.bal);
  return took;
}

/** Does this browser have a board profile the gems can land on? (the server re-checks: pay_reserve 'no_profile') */
export function hasProfile() {
  return !!(peekSecret() && getMyProfile());
}

/** -> { ok: true } after starting the redirect, or { ok: false, reason, spent_cents?, cap_cents? }. */
const authSession = async () => (await import('../leaderboard/auth.js')).session();
export async function startCheckout(packId, { fetchImpl = globalThis.fetch, go = (u) => window.location.assign(u), getSession = authSession } = {}) {
  const secret = peekSecret();
  if (!secret) return { ok: false, reason: 'no_profile' };
  const s = await getSession().catch(() => null);
  if (!s || !s.access) return { ok: false, reason: 'sign_in' };
  let r;
  try {
    r = await fetchImpl('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pack: packId, secret, access: s.access }) });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok || !data || typeof data.url !== 'string') {
    return { ok: false, reason: (data && data.error) || (r.status === 404 ? 'off' : 'offline'), spent_cents: data && data.spent_cents, cap_cents: data && data.cap_cents };
  }
  // only ever leave for Stripe's own checkout host (or this site, for the e2e mock)
  let host = '';
  try { host = new URL(data.url, window.location.href).host; } catch { host = ''; }
  if (host !== 'checkout.stripe.com' && host !== window.location.host) return { ok: false, reason: 'offline' };
  go(data.url);
  return { ok: true };
}

/** -> { rows, spent_cents, cap_cents, flagged, profile } | null (off / offline / 082 not run yet). */
export async function fetchPaid(call = rpc) {
  if (!LEADERBOARD_ENABLED) return null;
  const secret = peekSecret();
  if (!secret) return null;
  try {
    const d = await call('pay_gems_pending', { p_secret: secret });
    if (!d || typeof d !== 'object') return null;
    return {
      rows: Array.isArray(d.rows) ? d.rows : [],
      spent_cents: Math.max(0, Math.floor(Number(d.spent_cents) || 0)),
      cap_cents: Math.max(0, Math.floor(Number(d.cap_cents) || 0)),
      flagged: !!d.flagged,
      profile: d.profile !== false,
    };
  } catch {
    return null;
  }
}

/** Apply the rows once each, then ack. -> { credited, clawed, ids }. `onCredit(total)` runs before any grant. */
export async function applyPaid(rows, { onCredit, call = rpc } = {}) {
  const done = new Set(readApplied());
  const fresh = (Array.isArray(rows) ? rows : [])
    .map((r) => ({ id: Math.floor(Number(r && r.id)), delta: Math.trunc(Number(r && r.delta)) }))
    .filter((r) => Number.isFinite(r.id) && r.id > 0 && Number.isFinite(r.delta) && r.delta !== 0)
    .sort((a, b) => a.id - b.id);
  const toApply = fresh.filter((r) => !done.has(r.id));
  const net = toApply.reduce((s, r) => s + r.delta, 0);
  if (net > 0 && typeof onCredit === 'function') {
    try { onCredit(net); } catch { /* the fly is cosmetic */ }
  }
  let credited = 0;
  let clawed = 0;
  for (const r of toApply) {
    if (r.delta > 0) credited += grantGems(r.delta, 'paid', { detail: `pay:${r.id}` });
    else clawed += clawGems(-r.delta);
    done.add(r.id);
  }
  if (toApply.length) writeApplied([...done]);
  const ids = fresh.map((r) => r.id); // ack everything we hold (a re-sent, already-applied row is acked again)
  if (ids.length) {
    const secret = peekSecret();
    try { if (secret) await call('pay_gems_ack', { p_secret: secret, p_ids: ids }); } catch { /* re-sent next time; applied ids stop a double pay */ }
  }
  return { credited, clawed, ids };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/**
 * Pick up paid gems. poll=true (back from Stripe): ask every `everyMs` until a credit lands or `tries` run out.
 * -> the last fetchPaid() result + { credited, clawed }.
 */
export async function collectPaid({ poll = false, tries = 20, everyMs = 2000, onCredit, call = rpc } = {}) {
  let last = null;
  let credited = 0;
  let clawed = 0;
  for (let i = 0; i < (poll ? tries : 1); i += 1) {
    if (i) await wait(everyMs);
    const d = await fetchPaid(call);
    if (d) {
      last = d;
      const r = await applyPaid(d.rows, { onCredit, call });
      credited += r.credited;
      clawed += r.clawed;
      if (credited > 0) break;
    }
  }
  return { ...(last || {}), credited, clawed };
}
