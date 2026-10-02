// The ticker's ONLY text: fixed templates around a validated {k, n, v} (live.js cleanTick).
export function tickText(t) {
  if (!t) return '';
  if (t.k === 'lv') return `${t.n} just hit LV ${t.v}`;
  if (t.k === 'rank') return `${t.n} took #${t.v}`;
  if (t.k === 'rb') return `${t.n} reached REBIRTH ${t.v}`;
  return '';
}
