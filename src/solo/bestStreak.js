// bestStreak.js — the all-time BEST STREAK per solo mode (nov12, Andy: "they need to feel benefits of playing"). The run-over
// card names this run's peak streak and whether it beat the record. One localStorage row ({ mode: n }); a blocked store just
// means no record line (the run's own streak still shows).
const KEY = 'taw.bestStreak';

function read(store) {
  try { const v = JSON.parse(store.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/** Record `run` (this run's peak) for `mode`. Returns { run, best, isNew }: `best` is the record BEFORE this run. */
export function recordBestStreak(mode, run, store = typeof localStorage !== 'undefined' ? localStorage : null) {
  const n = Number.isFinite(run) && run > 0 ? Math.floor(run) : 0;
  if (!store || !mode) return { run: n, best: 0, isNew: false };
  const all = read(store);
  const best = Number.isFinite(all[mode]) ? all[mode] : 0;
  const isNew = n >= 2 && n > best;
  if (isNew) { try { store.setItem(KEY, JSON.stringify({ ...all, [mode]: n })); } catch { /* blocked store: no record */ } }
  return { run: n, best, isNew };
}
