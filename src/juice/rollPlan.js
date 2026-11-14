// rollPlan.js — the PURE half of rollDigits.js (ROLLING DIGITS, design research move 11): per character, whether it
// rolls, the digit it lands on and how long its strip spins. No DOM; unit-tested in rollPlan.test.js.

export const ROLL_MS = 700; // every digit has landed by here
export const ROLL_STAGGER = 50; // ms between neighbouring digits
export const ROLL_MIN_MS = 360; // the shortest single-digit roll (still reads as a roll, not a flicker)

/**
 * PURE: the roll plan for `text` — one entry per character: { ch, digit, d, ms }. Every digit starts at once; each lands
 * `stagger` after the digit on its left (the rightmost at `total`). The stagger shrinks for long numbers so the first
 * digit still rolls at least ROLL_MIN_MS.
 */
export function rollPlan(text, total = ROLL_MS) {
  const chars = [...String(text)];
  const nd = chars.filter((c) => c >= '0' && c <= '9').length;
  const stagger = nd > 1 ? Math.min(ROLL_STAGGER, Math.max(0, (total - ROLL_MIN_MS) / (nd - 1))) : 0;
  let fromRight = nd; // digits to the right of this one: the rightmost (0) rolls the longest and lands last
  return chars.map((ch) => {
    if (ch < '0' || ch > '9') return { ch, digit: false };
    fromRight -= 1;
    return { ch, digit: true, d: Number(ch), ms: Math.max(ROLL_MIN_MS, Math.round(total - stagger * fromRight)) };
  });
}
