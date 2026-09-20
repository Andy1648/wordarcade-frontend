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
import { formatNum, formatMultExact } from '../format';
import './PayoutBreakdown.css';

const pct = (x) => `${Math.round(x * 100)}%`;
// ×2 / ×1.5 / ×2.35 — the EXACT formatter, not the one-decimal `formatMult` the cards use. A
// receipt names single factors, and the streak ladder runs 1.05 / 1.10 / 1.20 / 1.25: rounded to
// one decimal a ×1.05 streak prints as "×1.1", which is a multiplier the game did not apply.
const mult = (m) => `×${formatMultExact(m)}`;

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
  // THE BASE IS A TERM, NOT A HEADING. "BASE 5" is the one number on the receipt the player
  // cannot check, because nothing says where a 5 came from. "5 letters × 10" is the same fact
  // with its working shown — the word's length against what a letter is worth at the player's
  // key tier — so every term in the product is named and the line multiplies out by hand.
  const baseTerm = payout.letters && payout.perLetter
    ? `${payout.letters} ${payout.letters === 1 ? 'LETTER' : 'LETTERS'} × ${formatNum(payout.perLetter)}`
    : `BASE ${formatNum(payout.base)}`;
  return (
    <div className={`payout${compact ? ' payout--compact' : ''}`} aria-label="Payout breakdown">
      {/* BOTH CURRENCIES, one above the math that produced them. Wins are the word's XP ÷ 10, so
          the two headline numbers are one number read twice — printing only the wins half was
          hiding the half the level bar is counting. */}
      <div className="payout-headline">
        <span className="payout-headline-xp">+{formatNum(payout.xp)}<span className="payout-headline-unit"> XP</span></span>
        <span className="payout-headline-sep" aria-hidden="true">·</span>
        <span className="payout-headline-wins">+{formatNum(payout.paid)}<span className="payout-headline-unit"> WINS</span></span>
      </div>
      {/* EVERY TERM, IN ORDER, ON ONE LINE. A vertical list of label/value pairs read as a table
          of unrelated facts; the product is a single sentence and now looks like one. */}
      <div className="payout-math">
        <span className="payout-term payout-term--base">{baseTerm}</span>
        {rows.map((r) => (
          <span key={r.key} className={`payout-term payout-term--${r.kind}`}>
            <span className="payout-k">{r.label}</span>
            <span className="payout-v">{mult(r.mult)}</span>
          </span>
        ))}
        {more && (
          <span className="payout-term payout-term--more">
            <span className="payout-k">+{more.n} MORE</span>
            <span className="payout-v">{mult(more.mult)}</span>
          </span>
        )}
      </div>
      {payout.held && (
        <div className="payout-held">HELD — BANKS AT 3 WORDS</div>
      )}
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
