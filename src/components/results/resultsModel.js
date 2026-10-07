// results/resultsModel.js — the NUMBERS behind the v2 RESULTS card (claude/mockups/v2/Results.dc.html, P9b). PURE: no
// DOM, no storage — node:test covers it (resultsModel.test.js). The card only DISPLAYS what the game already paid:
//
//   * placement  — #1 = the server's winner; the rest by who went out LAST (the elimination order the screen saw);
//                  a seat that never went out sits right under the winner (by words);
//   * xpBetween  — the XP a bar travelled from {level, frac} to {level, frac} on the level curve `need`;
//   * tally      — EVERY credited win as its own line: WORDS (the run's per-word money: BASE × the chain) and then
//                  each bonus the wins ledger named (WINNER BONUS, SECRET FIND, an achievement …). TOTAL = the sum of
//                  the lines, never anything else (no unexplained wins);
//   * chain      — the multiplier chain, shown ONCE: each factor the round's words actually used (payout ledger rows,
//                  the round's average ×), and the effective ×M that turns BASE into the WORDS line.

const int0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Placement order. `players` [{id, name}], `winnerId`, `elimOrder` (ids in the order they went out), `wordsBy`
 * { id: words }. Returns [{ id, name, place, words }] best first.
 */
export function placementOrder({ players = [], winnerId = null, elimOrder = [], wordsBy = {} } = {}) {
  const seen = new Set();
  const list = (players || []).filter((p) => p && p.id != null && !seen.has(p.id) && seen.add(p.id));
  const out = (elimOrder || []).filter((id) => list.some((p) => p.id === id));
  const outIdx = new Map(out.map((id, i) => [id, i]));
  const w = (id) => int0(wordsBy && wordsBy[id]);
  const rank = (p) => {
    if (p.id === winnerId) return [0, 0, 0];
    if (!outIdx.has(p.id)) return [1, -w(p.id), 0]; // still standing at the end (left / timed out game): under the winner
    return [2, -outIdx.get(p.id), -w(p.id)]; // went out later = placed higher
  };
  const sorted = [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < 3; i += 1) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });
  return sorted.map((p, i) => ({ id: p.id, name: p.name, place: i + 1, words: w(p.id) }));
}

/** The XP the bar travelled from `a` to `b` ({level, frac}) on the curve `need(level)`; null when too far to sum. */
export function xpBetween(a, b, need, { maxLevels = 4000 } = {}) {
  const la = Math.max(1, int0(a && a.level));
  const lb = Math.max(1, int0(b && b.level));
  const fa = Math.min(1, Math.max(0, Number(a && a.frac) || 0));
  const fb = Math.min(1, Math.max(0, Number(b && b.frac) || 0));
  if (lb < la || (lb === la && fb <= fa)) return 0;
  if (lb === la) return (fb - fa) * need(la);
  if (lb - la > maxLevels) return null;
  let s = (1 - fa) * need(la);
  for (let l = la + 1; l < lb; l += 1) s += need(l);
  return s + fb * need(lb);
}

/**
 * The multiplier chain: { base, mult, chips: [{ key, label, mult }] } — the payout ledger's rows, biggest first.
 * `split` (SEASON 2, PROGRESSION FINAL): the ledger's REBIRTH row is 2^R × (1 + ★) there; given { rebirth, star } it is
 * shown as its two FINAL factors — REBIRTH ×2^R and ★ ×(1 + ★) — so the chain reads like the FINAL formula.
 */
export function chainOf(ledger, wordsWins, split = null) {
  const base = ledger && Number.isFinite(ledger.base) ? Math.max(0, ledger.base) : 0;
  const words = Math.max(0, Number(wordsWins) || 0);
  const chips = [];
  for (const r of (ledger && ledger.rows) || []) {
    if (!r || !Number.isFinite(r.mult) || Math.abs(r.mult - 1) <= 0.004) continue;
    if (r.key === 'rebirth' && split && Number.isFinite(split.rebirth) && Number.isFinite(split.star)) {
      if (Math.abs(split.rebirth - 1) > 0.004) chips.push({ key: 'rebirth', label: 'REBIRTH', mult: split.rebirth });
      if (Math.abs(split.star - 1) > 0.004) chips.push({ key: 'star', label: '★', mult: split.star });
      continue;
    }
    chips.push({ key: r.key, label: r.label, mult: r.mult });
  }
  return { base, mult: base > 0 ? words / base : 0, chips };
}

/**
 * EVERY credited win, one line each. `wordsWins` = the run's per-word wins (App winsEarnedTotal); `bonusLines` = the
 * wins ledger's named bonus entries for this run (App winsBonusLines: { id, label, amount }); `ledger` = the payout
 * ledger (its `bonuses` add the ×mult and the H4 note to a matching line). Returns { lines, total }.
 */
export function tallyLines({ wordsWins = 0, bonusLines = [], ledger = null } = {}) {
  const words = Math.max(0, Number(wordsWins) || 0);
  const lines = [{ key: 'WORDS', label: 'WORDS', amount: words, kind: 'words' }];
  const extra = ((ledger && ledger.bonuses) || []).slice();
  for (const l of bonusLines || []) {
    if (!l || l.kind !== 'bonus' || !(l.amount > 0)) continue;
    const i = extra.findIndex((b) => b && b.label === l.label);
    const b = i >= 0 ? extra.splice(i, 1)[0] : null;
    lines.push({ key: String(l.id != null ? l.id : l.label), label: l.label, amount: l.amount, kind: 'bonus', mult: b ? b.mult : null, note: b ? b.note : null });
  }
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) };
}

/** The hero stamp for a placement: WIN (#1), TOP 3, or KO'D. */
export function stampFor(place, iWon) {
  if (iWon || place === 1) return { text: 'WIN', tone: 'win' };
  if (place > 0 && place <= 3) return { text: 'TOP 3', tone: 'top' };
  return { text: "KO'D", tone: 'ko' };
}
