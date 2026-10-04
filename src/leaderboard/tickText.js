import { formatNum } from '../format.js';

// The ticker's ONLY text: fixed templates around a validated {k, n, v} (live.js cleanTick).
export function tickText(t) {
  if (!t) return '';
  if (t.k === 'lv') return `${t.n} just hit LV ${formatNum(t.v)}`;
  if (t.k === 'rank') return `${t.n} took #${formatNum(t.v)}`;
  if (t.k === 'rb') return `${t.n} reached REBIRTH ${formatNum(t.v)}`;
  return '';
}
