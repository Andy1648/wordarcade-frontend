// bestLane.js — the solo BEST LANE (nov26, Andy: the language rushes are "a bit flat and boring rn"). A solo run
// races your own best run of the same language, mode and length: the progress strip carries a second lane, the
// best run's right answers at the same point. Pull ahead of it and the strip says so once; finish with more right
// answers than it had and this run becomes the one to beat.
//
// A record is the best run's right answers after each answer: [0, 1, 2, 2, 3 …] (index = answers given). Pure
// helpers + a guarded storage read/write (private windows and blocked storage simply have no record).

const keyOf = (lang, mode, total) => `wa_${lang}rush_best_${mode === 'briefing' ? 'briefing' : 'lineup'}_${total}`;

/** The right answers after each answer of a finished run, from its runLog ({ ok } per answer). */
export function paceOf(runLog) {
  const out = [0];
  let right = 0;
  for (const e of runLog || []) {
    if (e && e.ok) right += 1;
    out.push(right);
  }
  return out;
}

/** The best run's right answers after `answered` answers (it stops climbing once its run ended). */
export function bestAt(pace, answered) {
  if (!Array.isArray(pace) || !pace.length) return null;
  return pace[Math.min(Math.max(0, answered), pace.length - 1)];
}

export function readBest(lang, mode, total) {
  if (!total) return null;
  try {
    const raw = window.localStorage.getItem(keyOf(lang, mode, total));
    const pace = raw ? JSON.parse(raw) : null;
    return Array.isArray(pace) && pace.every((n) => Number.isInteger(n)) ? pace : null;
  } catch {
    return null;
  }
}

/** Keep this run if it beat the record. Returns { isNew, beat } — beat = there was a record and this passed it. */
export function saveIfBest(lang, mode, total, runLog) {
  const pace = paceOf(runLog);
  const right = pace[pace.length - 1];
  const prev = readBest(lang, mode, total);
  const prevRight = prev ? prev[prev.length - 1] : -1;
  if (right <= prevRight || right === 0) return { isNew: false, beat: false };
  try {
    window.localStorage.setItem(keyOf(lang, mode, total), JSON.stringify(pace));
  } catch {
    /* no storage: no record */
  }
  return { isNew: true, beat: !!prev };
}
