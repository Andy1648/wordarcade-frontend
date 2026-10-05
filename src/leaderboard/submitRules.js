// submitRules.js — the board-row write rule of supabase/migrations/017_board_reality.sql, as a pure
// JS function (no DOM, no fetch), so node:test can pin every branch and the e2e board mock can apply it.
//
// KEEP IN SYNC WITH private.lb_board_write in 017_board_reality.sql (decideSubmit) and
// private.lb_board_write_rr in 018_rebirth_rush.sql (decideSubmitRR, at the bottom — the live rule once 018
// runs): the same branches in the same order, the same constants. A change to one is a change to both.
//
//   1. first submit (no submitted_at)      → BASELINE as submitted, no weekly words
//   2. < 5 s since the last accepted submit → THROTTLED (nothing written)
//   3. any number LOWER than stored         → RESET: a new baseline (017). Lowering numbers can never
//      (rebirths, words, letters, or level      help a cheater climb. Values lower than stored are written
//       at the same rebirth count)              as submitted; anything that went UP in the same submit is
//                                               still bounded (the mixed case below). No weekly words.
//   4. otherwise                            → INCREASE: rate-checked exactly as 011/013/015 —
//                                               words > 20/s or letters > 150/s → REJECTED;
//                                               rebirths rise ≤ 1 per submit; level rise ≤ 0.5/s since the
//                                               last accepted submit (banking ≤ 20 min = 600 levels), counted
//                                               from 1 after a rebirth; weekly words += the words delta.
//
// MIXED CASE (a reset that also went UP somewhere — e.g. rebirths 7 → 0 but level 12 → 175): the level is
// capped at max(stored level, 1 + allowance) — the 015 clamp COUNTED FROM 1, because a reset restarts the
// climb at 1, but never forced below what the row already showed (that level was already on the board, so
// keeping it is not a climb; the lowered rebirths/words already drop the row). Rebirths rise ≤ 1; words and
// letters that went up are capped at the rate limit (20/s, 150/s) instead of rejecting the submit.

export const THROTTLE_MS = 5000;
export const WORDS_PER_SEC = 20;
export const LETTERS_PER_SEC = 150;
export const LEVELS_PER_SEC = 0.5;
export const LEVEL_BANK_SECS = 1200;

const int = (v, min, dflt) => {
  const n = Number(v);
  return Math.max(min, Number.isFinite(n) ? Math.floor(n) : dflt);
};

/**
 * @param {{level:number, rebirths:number, lifetime_words:number, lifetime_letters:number, submitted_at:number|null}} old
 *   the stored row (submitted_at in ms since epoch, null = never submitted)
 * @param {{level:number, rebirths:number, words:number, letters:number}} sub  the submitted values
 * @param {number} now  ms since epoch
 * @returns {{action:'first'|'throttled'|'reset'|'increase'|'rejected', row?:object, weekDelta?:number}}
 *   `row` is what gets written (level, rebirths, lifetime_words, lifetime_letters, submitted_at)
 */
export function decideSubmit(old, sub, now) {
  const lv = int(sub.level, 1, 1);
  const rb = int(sub.rebirths, 0, 0);
  const w = int(sub.words, 0, 0);
  const l = int(sub.letters, 0, 0);
  const write = (level, rebirths, words, letters) => ({ level, rebirths, lifetime_words: words, lifetime_letters: letters, submitted_at: now });

  if (old.submitted_at == null) return { action: 'first', row: write(lv, rb, w, l), weekDelta: 0 };
  // SQL: submitted_at >= now() - interval '5 seconds' → throttled
  if (old.submitted_at >= now - THROTTLE_MS) return { action: 'throttled' };

  const oLv = int(old.level, 1, 1);
  const oRb = int(old.rebirths, 0, 0);
  const oW = int(old.lifetime_words, 0, 0);
  const oL = int(old.lifetime_letters, 0, 0);
  const secs = Math.max(1, (now - old.submitted_at) / 1000);
  const maxRise = Math.max(1, Math.floor(Math.min(secs, LEVEL_BANK_SECS) * LEVELS_PER_SEC));

  if (rb < oRb || w < oW || l < oL || (lv < oLv && rb === oRb)) {
    // 017 RESET → new baseline
    return {
      action: 'reset',
      row: write(
        Math.min(lv, Math.max(oLv, 1 + maxRise)),
        Math.min(rb, oRb + 1),
        Math.min(w, oW + Math.floor(WORDS_PER_SEC * secs)),
        Math.min(l, oL + Math.floor(LETTERS_PER_SEC * secs)),
      ),
      weekDelta: 0,
    };
  }

  if (w - oW > WORDS_PER_SEC * secs) return { action: 'rejected' };
  if (l - oL > LETTERS_PER_SEC * secs) return { action: 'rejected' };
  const rb2 = Math.min(rb, oRb + 1);
  const base = rb2 > oRb ? 1 : oLv;
  return { action: 'increase', row: write(Math.min(lv, base + maxRise), rb2, w, l), weekDelta: Math.max(0, w - oW) };
}

// ---- REBIRTH RUSH (supabase/migrations/018_rebirth_rush.sql, private.lb_board_write_rr) --------------------
// KEEP IN SYNC WITH private.lb_board_write_rr: same branches, order and constants. 017's rule above stays as
// decideSubmit (the e2e board mock still applies it). Differences from 017:
//   * REBIRTHS: a token bucket — 1 token per RB_SECS (60 s), at most RB_BURST (60) banked; rb_clock = the
//     moment the bucket was empty (null = full). Rise ≤ conversion bonus + tokens; spent tokens move rb_clock
//     forward RB_SECS each. No free "+1 per submit".
//   * THE CONVERSION: while the stored row's econ < 12, bonus = floor((L − gate) / 18) + 1 when L ≥ gate
//     (L = stored level, gate = 15 + 18·stored rebirths) — free, and the write sets econ = 12 (once).
//   * LEVEL: ≤ max(15 + 18·R + LV_HEADROOM, base + 015's allowance); base = 1 after a rebirth or a reset, else
//     the stored level. A reset keeps "never forced below the stored level".
export const RR_ECON = 12;
// 020 (Andy oct5, the R100-in-422-words row): rebirths are bounded by PLAY, not only by wall time. Measured on the
// shipped economy (claude/econ-oct2 fast bot, every reward on): an honest FAST player needs ≥ 80 words for R1 and
// more for every later one, and rebirths at most ~6 an hour early on. So the board allows ~2× that, no more:
//   * TIME: 1 token per RB_SECS (300 s = 12 an hour), at most RB_BURST (12) banked;
//   * PLAY: rebirths ≤ floor(lifetime words / WORDS_PER_RB) — a rise past that is clipped. Rows already above it KEEP
//     their count (existing players keep what they have); they rise again once their words catch up.
//   * FIRST submit (a new name): rebirths ≤ that same play cap + FIRST_CONV_ALLOW (the legit one-time conversion max).
export const RB_SECS = 300;
export const RB_BURST = 12;
export const WORDS_PER_RB = 40;
export const FIRST_CONV_ALLOW = 7;
/** The rebirth count `words` of verified play can carry (020). */
export function playRebirthCap(words) {
  const w = Number.isFinite(words) && words > 0 ? Math.floor(words) : 0;
  return Math.floor(w / WORDS_PER_RB);
}
export const LV_HEADROOM = 50; // 019: two rebirths' worth at 25 a rebirth
// the LIVE rebirth gate (019, Andy oct5): 25 × (R+1) — the level cap follows it
export const GATE_BASE = 25;
export const GATE_STEP = 25;
// the one-time CONVERSION keeps the gate it shipped with (018 old_gate = 15 + 18·R), the same for every save
export const CONV_GATE_BASE = 15;
export const CONV_GATE_STEP = 18;
// The one-time conversion bonus is CAPPED at 15 rebirths (018's CONV_CAP): it trusts the STORED level, so a forged
// old level (LV5000) would otherwise mint hundreds of rebirths in one submit. Legit board max is +7.
export const CONV_CAP = 15;

/**
 * @param {{level:number, rebirths:number, lifetime_words:number, lifetime_letters:number, submitted_at:number|null,
 *          econ?:number, rb_clock?:number|null}} old  the stored row (times in ms since epoch)
 * @param {{level:number, rebirths:number, words:number, letters:number}} sub
 * @param {number} now  ms since epoch
 * @returns {{action:'first'|'throttled'|'reset'|'increase'|'rejected', row?:object, weekDelta?:number, conv?:number, tokens?:number}}
 *   `row` = level, rebirths, lifetime_words, lifetime_letters, submitted_at, econ (12), rb_clock
 */
export function decideSubmitRR(old, sub, now) {
  const lv = int(sub.level, 1, 1);
  const rb = int(sub.rebirths, 0, 0);
  const w = int(sub.words, 0, 0);
  const l = int(sub.letters, 0, 0);
  const oldClock = old.rb_clock == null ? null : Number(old.rb_clock);
  const write = (level, rebirths, words, letters, rbClock) => ({
    level, rebirths, lifetime_words: words, lifetime_letters: letters, submitted_at: now, econ: RR_ECON, rb_clock: rbClock,
  });

  if (old.submitted_at == null) {
    // 020: a first submit is a baseline, but its rebirths are bounded by its own play (+ the conversion allowance)
    const rbFirst = Math.min(rb, playRebirthCap(w) + FIRST_CONV_ALLOW);
    return { action: 'first', row: write(Math.min(lv, GATE_BASE + GATE_STEP * rbFirst + LV_HEADROOM), rbFirst, w, l, oldClock), weekDelta: 0 };
  }
  if (old.submitted_at >= now - THROTTLE_MS) return { action: 'throttled' };

  const oLv = int(old.level, 1, 1);
  const oRb = int(old.rebirths, 0, 0);
  const oW = int(old.lifetime_words, 0, 0);
  const oL = int(old.lifetime_letters, 0, 0);
  const secs = Math.max(1, (now - old.submitted_at) / 1000);
  const maxRise = Math.max(1, Math.floor(Math.min(secs, LEVEL_BANK_SECS) * LEVELS_PER_SEC));
  // the one-time conversion bonus, from the STORED row
  const oldGate = CONV_GATE_BASE + CONV_GATE_STEP * oRb;
  const conv = (Number(old.econ) || 0) < RR_ECON && oLv >= oldGate ? Math.min(CONV_CAP, Math.floor((oLv - oldGate) / CONV_GATE_STEP) + 1) : 0;
  // rebirth tokens: 1 per RB_SECS since rb_clock, at most RB_BURST (null clock = full bucket)
  const effClock = Math.max(oldClock == null ? -Infinity : oldClock, now - RB_SECS * RB_BURST * 1000);
  const tokens = Math.min(RB_BURST, Math.floor((now - effClock) / 1000 / RB_SECS));
  const isReset = rb < oRb || w < oW || l < oL || (lv < oLv && rb === oRb);

  if (!isReset) {
    if (w - oW > WORDS_PER_SEC * secs) return { action: 'rejected' };
    if (l - oL > LETTERS_PER_SEC * secs) return { action: 'rejected' };
  }
  // 020: the rise is bounded by tokens AND by play (rows already above the play cap keep what they have)
  const rb2 = Math.min(rb, oRb + conv + tokens, Math.max(oRb + conv, playRebirthCap(w)));
  const spent = Math.max(0, rb2 - oRb - conv);
  const clock = spent > 0 ? effClock + RB_SECS * spent * 1000 : oldClock;
  const base = isReset || rb2 > oRb ? 1 : oLv;
  const lvCap = Math.max(GATE_BASE + GATE_STEP * rb2 + LV_HEADROOM, base + maxRise);
  if (isReset) {
    return {
      action: 'reset',
      row: write(
        Math.min(lv, Math.max(oLv, lvCap)),
        rb2,
        Math.min(w, oW + Math.floor(WORDS_PER_SEC * secs)),
        Math.min(l, oL + Math.floor(LETTERS_PER_SEC * secs)),
        clock,
      ),
      weekDelta: 0,
      conv,
      tokens,
    };
  }
  return { action: 'increase', row: write(Math.min(lv, lvCap), rb2, w, l, clock), weekDelta: Math.max(0, w - oW), conv, tokens };
}
