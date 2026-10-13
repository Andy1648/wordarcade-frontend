// boostSpan.js — the BoostDock drain bar's memory of each boost's full length (pure; boostSpan.test.js).
// The drain bar needs each boost's FULL length, which the timers don't store (only `until`). The dock remembers the
// longest it has seen per boost (keyed by its end time) — so a reload mid-boost keeps the bar where it was. A later
// end time on a still-running boost is an extension (+5 MIN): its length grows by the same amount.
export const SPAN_KEY = 'taw.bd.span';
export const readSpans = () => {
  try {
    const o = JSON.parse(localStorage.getItem(SPAN_KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
};
/** { frac 0..1, grew } for boost `id` with `ms` left. Mutates + persists the span map only when it changes. */
export function spanOf(spans, id, ms, now = Date.now()) {
  const until = now + ms;
  const e = spans[id];
  let grew = false;
  let dirty = false;
  if (!e || e.u < now - 2000 || until < e.u - 2000) {
    spans[id] = { u: until, t: ms };
    dirty = true;
  } else if (until > e.u + 2000) {
    e.t += until - e.u;
    e.u = until;
    grew = true;
    dirty = true;
  }
  const t = Math.max(spans[id].t, ms, 1);
  return { frac: Math.min(1, Math.max(0, ms / t)), grew, dirty };
}

