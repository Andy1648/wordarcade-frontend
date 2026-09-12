// PayoutBreakdown.jsx — the receipt for a payout.
//
// "I got 40k and couldn't tell where it came from." A word's wins are a PRODUCT of up to nine
// multipliers — mode, difficulty, level, rebirth, momentum, WORD SENSE, rarity, combo, lucky — and
// before this nothing on screen named any of them. Two views on the same data (src/progress/payout.js):
//
//   <WordPayout>  one word, at accept time: base × each live multiplier = what you were paid.
//   <RoundPayout> the whole round, on the end screen: each factor's SHARE of everything you earned
//                 above the flat base, biggest first.
//
// Both are read-only readouts of numbers wins.js has already paid. Neither computes a payout, so
// neither can ever quote a multiplier the player did not actually get.
import Num from './Num';
import './PayoutBreakdown.css';

const pct = (x) => `${Math.round(x * 100)}%`;
// ×2 / ×1.5 / ×2.35 — trailing zeros trimmed, because "×2.00" reads like a different number.
const mult = (m) => `×${Number(m.toFixed(2))}`;

/**
 * ONE WORD. `payout` is buildPayout()'s result; `inactive` is inactivePayoutFactors()'s, which is
 * the other half of legibility — an upgrade that is doing NOTHING on this word says so, instead of
 * leaving the player to guess whether they wasted their wins.
 */
export function WordPayout({ payout, inactive = [], compact = false, limit = 4 }) {
  if (!payout || !payout.rows) return null;
  // COMPACT lands mid-game, over a board the player is still reading, so it shows the BIGGEST
  // reasons rather than all nine and folds the rest into one honest line: base × (shown) × (more)
  // is still exactly what was paid, so the short version never lies by omission. The full panel
  // on the end screen keeps the fixed published order.
  let rows = payout.rows;
  let more = null;
  if (compact && rows.length > limit) {
    const ranked = [...rows].sort((a, b) => Math.abs(Math.log(b.mult)) - Math.abs(Math.log(a.mult)));
    rows = ranked.slice(0, limit);
    const rest = ranked.slice(limit);
    more = { n: rest.length, mult: rest.reduce((a, r) => a * r.mult, 1) };
  }
  return (
    <div className={`payout${compact ? ' payout--compact' : ''}`} aria-label="Payout breakdown">
      <div className="payout-head">
        <span className="payout-head-label">BASE</span>
        <span className="payout-head-val"><Num value={payout.base} /></span>
      </div>
      <div className="payout-rows">
        {rows.map((r) => (
          <div key={r.key} className={`payout-row payout-row--${r.kind}`}>
            <span className="payout-k">{r.label}</span>
            <span className="payout-v">{mult(r.mult)}</span>
          </div>
        ))}
        {more && (
          <div className="payout-row payout-row--more">
            <span className="payout-k">+{more.n} MORE</span>
            <span className="payout-v">{mult(more.mult)}</span>
          </div>
        )}
      </div>
      <div className="payout-total">
        <span className="payout-k">PAID</span>
        <Num value={payout.total} className="payout-total-val" />
      </div>
      {inactive.length > 0 && !compact && (
        <div className="payout-off">
          {inactive.map((f) => (
            <div key={f.key} className="payout-off-row">
              <span className="payout-k">{f.label}</span>
              <span className="payout-why">{f.why}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * THE WHOLE ROUND. `ledger` is readPayoutLedger()'s result.
 *
 * The bar is a SHARE, and the copy says share rather than "COMBO earned you N": the payout is a
 * product, so no factor has a separable amount of its own. The split is proportional to ln(mult),
 * which is the only attribution that sums to exactly what was earned and gives two equal
 * multipliers equal credit (see payout.js).
 */
export function RoundPayout({ ledger }) {
  if (!ledger || !ledger.words) return null;
  const top = ledger.rows.length ? ledger.rows[0].share : 1;
  return (
    <div className="payout payout--round" aria-label="Where your wins came from">
      <div className="payout-title">WHERE YOUR WINS CAME FROM</div>
      <div className="payout-head">
        <span className="payout-head-label">{ledger.words} WORDS × BASE</span>
        <span className="payout-head-val"><Num value={ledger.base} /></span>
      </div>
      {ledger.rows.length === 0 ? (
        <div className="payout-none">NO MULTIPLIERS THIS ROUND — every word paid the flat base.</div>
      ) : (
        <div className="payout-rows">
          {ledger.rows.map((r) => (
            <div key={r.key} className={`payout-row payout-row--${r.kind}`}>
              <span className="payout-k">{r.label}</span>
              {/* Width is a share of the BIGGEST row, not of 100%, so the smallest contributor is
                  still a visible bar rather than a sliver that reads as zero. */}
              <span className="payout-bar" style={{ '--w': pct(top > 0 ? r.share / top : 0) }} />
              <span className="payout-avg">{mult(r.mult)}</span>
              <Num value={r.wins} prefix="+" className="payout-v" />
            </div>
          ))}
        </div>
      )}
      <div className="payout-total">
        <span className="payout-k">TOTAL</span>
        <Num value={ledger.total} className="payout-total-val" />
      </div>
    </div>
  );
}
