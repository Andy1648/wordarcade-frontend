// finalRules.js — 029_progression_final_v3.sql's SEASON-2 BOARD WRITE (private.lb_board_write_s2, PROGRESSION FINAL v3),
// as pure JS (no DOM, no fetch, no clock) so node:test, the e2e board mock and the CI sim run the rule the database runs.
// (029's lb_rebirth / lb_ascend season-2 rules live in rebirthRules.js, beside the season-0 ones.)
//
// KEEP IN SYNC WITH supabase/migrations/029_progression_final_v3.sql: same branches, order and constants —
// finalRules.test.js pins the SQL text against them.
//
// FINAL v3 levels are geometric (need(n) = 100 × 1.15^(n−1)) and a rebirth sends the level back to 1 at the gate
// LV 18 + 20·R, so a stored level sits near or below that gate. The caps:
//   * FIRST season-2 write (never submitted, or a row whose last write was not season 2): a baseline — rebirths ≤
//     lifetime words / F_WORDS_PER_RB, level ≤ the next gate + F_LV_HEADROOM; no weekly words;
//   * after that: rebirths never rise on a submit (lb_rebirth only), stars are never written (lb_ascend only); the
//     level is free up to 18 + 20·R + F_LV_HEADROOM, or the stored level + F_LEVELS_PER_SEC a second since the last
//     accepted write (banking F_LEVEL_BANK_SECS) — whichever is higher; clamped, never rejected; ≤ the int column;
//   * words / letters rate-checked as 011/013/015 (too fast → rejected); a lower number is a RESET (017).
export const F_ECON = 13;
export const F_GATE_BASE = 18; // the rebirth gate: LV 18 + 20·R
export const F_GATE_STEP = 20;
export const F_LV_HEADROOM = 100; // levels allowed past the next gate (≈ 40 min of median play past it)
export const F_LEVELS_PER_SEC = 1; // or + 1 level a second since the last accepted write (≫ the ~0.04/s honest pace) …
export const F_LEVEL_BANK_SECS = 1200; // … banking 20 min
export const F_WORDS_PER_RB = 100; // a first season-2 write: rebirths ≤ lifetime words / 100
export const F_LV_MAX = 2147483647; // the int column
export const THROTTLE_MS = 5000;
export const WORDS_PER_SEC = 20;
export const LETTERS_PER_SEC = 150;

const int = (v, min, d) => {
  const n = Number(v);
  return Math.max(min, Number.isFinite(n) ? Math.floor(n) : d);
};

/** The level room at `rebirths`: 18 + 20·R + 100 (capped at the int column). */
export function finalLevelRoom(rebirths) {
  return Math.min(F_LV_MAX, F_GATE_BASE + F_GATE_STEP * int(rebirths, 0, 0) + F_LV_HEADROOM);
}

/**
 * private.lb_board_write_s2 (029), modelled. `old` = the stored row ({ level, rebirths, lifetime_words,
 * lifetime_letters, submitted_at (ms|null), econ }); `sub` = { level, rebirths, words, letters }; `now` ms.
 * Returns { action: 'throttled'|'rejected'|'first'|'reset'|'increase', row?, weekDelta } (decideSubmitS2's shape).
 */
export function decideSubmitFinal(old, sub, now) {
  if (old.submitted_at != null && old.submitted_at >= now - THROTTLE_MS) return { action: 'throttled', weekDelta: 0 };
  let lv = int(sub.level, 1, 1);
  let rb = int(sub.rebirths, 0, 0);
  let w = int(sub.words, 0, 0);
  let l = int(sub.letters, 0, 0);
  const write = (level, rebirths, words, letters) => ({ level, rebirths, lifetime_words: words, lifetime_letters: letters, submitted_at: now, econ: F_ECON });
  if (old.submitted_at == null || Number(old.econ) !== F_ECON) {
    rb = Math.min(rb, Math.floor(w / F_WORDS_PER_RB));
    lv = Math.min(lv, finalLevelRoom(rb));
    return { action: 'first', row: write(lv, rb, w, l), weekDelta: 0 };
  }
  const secs = Math.max(1, (now - old.submitted_at) / 1000);
  const maxRise = Math.floor(Math.min(secs, F_LEVEL_BANK_SECS) * F_LEVELS_PER_SEC);
  const oRb = int(old.rebirths, 0, 0);
  const oLv = int(old.level, 1, 1);
  const oW = int(old.lifetime_words, 0, 0);
  const oL = int(old.lifetime_letters, 0, 0);
  const isReset = rb < oRb || w < oW || l < oL || (lv < oLv && rb === oRb);
  if (!isReset) {
    if (w - oW > WORDS_PER_SEC * secs) return { action: 'rejected', weekDelta: 0 };
    if (l - oL > LETTERS_PER_SEC * secs) return { action: 'rejected', weekDelta: 0 };
  }
  rb = Math.min(rb, oRb); // a submit never raises rebirths (lb_rebirth only)
  const base = isReset ? 1 : oLv;
  const lvCap = Math.min(F_LV_MAX, Math.max(finalLevelRoom(rb), base + maxRise));
  if (isReset) {
    lv = Math.min(lv, Math.max(oLv, lvCap));
    w = Math.min(w, oW + Math.floor(WORDS_PER_SEC * secs));
    l = Math.min(l, oL + Math.floor(LETTERS_PER_SEC * secs));
    return { action: 'reset', row: write(lv, rb, w, l), weekDelta: 0 };
  }
  lv = Math.min(lv, lvCap);
  return { action: 'increase', row: write(lv, rb, w, l), weekDelta: Math.max(0, w - oW) };
}
