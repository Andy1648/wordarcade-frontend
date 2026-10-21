// contracts/bus.js — the DAILY CONTRACTS event door (eager, tiny). The hooks every mode already passes through call
// contractEvent(); the first call lazy-loads contracts/live.js (pool, storage, grants, toasts) and every queued event
// is handled in arrival order. Node (unit tests, the sim) has no window: a no-op, so no suite changes behaviour.
const MAX_QUEUE = 200;
const queue = [];
let live = null;
let loading = null;

export const CONTRACTS_KEY = 'taw.contracts';
/** Fired on window after every write — the menu's DAILY tile and the sheet re-read on it. */
export const CONTRACTS_CHANGE = 'taw:contracts-change';
/** The LOCAL calendar day ('YYYY-MM-DD'). */
export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** The stored day as-is ({ picks, done } — null when absent / not today). The menu tile reads this without loading
 *  the pool (payload ratchet); live.js deals a new day. */
export function peekToday() {
  try {
    const s = JSON.parse(localStorage.getItem(CONTRACTS_KEY) || 'null');
    return s && s.day === dayKey() && Array.isArray(s.picks) && Array.isArray(s.done) ? s : null;
  } catch {
    return null;
  }
}
/** Load the live half (deals today, handles events). */
export function loadLive() {
  if (live) return Promise.resolve(live);
  if (!loading) loading = import('./live.js').then((m) => { live = m; flush(); return m; }, (e) => { loading = null; throw e; });
  return loading;
}

function flush() {
  while (queue.length) {
    const ev = queue.shift();
    try { live.handle(ev); } catch { /* a contract failure never reaches the accept path */ }
  }
}

/** One game event (contracts/pool.js EVENTS). Never throws. */
export function contractEvent(type, payload = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (queue.length < MAX_QUEUE) queue.push({ ...payload, type });
    if (live) { flush(); return; }
    loadLive().catch(() => {});
  } catch {
    /* guarded */
  }
}
