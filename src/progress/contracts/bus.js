// contracts/bus.js — the DAILY CONTRACTS event door (eager, tiny). The hooks every mode already passes through call
// contractEvent(); the first call lazy-loads contracts/live.js (pool, storage, grants, toasts) and every queued event
// is handled in arrival order. Node (unit tests, the sim) has no window: a no-op, so no suite changes behaviour.
const MAX_QUEUE = 200;
const queue = [];
let live = null;
let loading = null;

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
    if (!loading) {
      loading = import('./live.js').then((m) => { live = m; flush(); }, () => { loading = null; });
    }
  } catch {
    /* guarded */
  }
}
