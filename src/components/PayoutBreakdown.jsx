// PayoutBreakdown.jsx — the receipt for a payout.
//
// "I got 40k and couldn't tell where it came from." A word's wins are a PRODUCT — Rebirth Rush:
// BASE 10 × length/5 × MODE × REBIRTH × MARK × BOOST (× FRENZY on FUSE) — and once nothing on
// screen named any of them. Two views on the same data (src/progress/payout.js):
//
//   <WordPayout>  one word, at accept time: base × each live multiplier = what you were paid.
//   <RoundPayout> the whole round, on the end screen: each factor's SHARE of everything you earned
//                 above the flat base, biggest first.
//
// Both are read-only readouts of numbers wins.js has already paid. Neither computes a payout, so
// neither can ever quote a multiplier the player did not actually get.
import Num from './Num';
import { formatNum, formatRate, formatMultExact } from '../format';
import './PayoutBreakdown.css';
import { wornMarkId, markEntry } from '../progress/markRollsCore';
import { rarityClass } from '../lib/rarityStyle.js';
import RarityFx from './rarity/RarityFx';

// RARITY IDENTITY (Andy oct5): the receipt's MARK term wears the worn mark's tier (fill + glow; shimmer /
// sparks on the end-screen receipt only — the mid-game compact receipt mounts per word, so it stays CSS-only).
function wornMarkLook() {
  try {
    const id = wornMarkId();
    const e = id ? markEntry(id) : null;
    return e ? { tier: e.tier } : null;
  } catch {
    return null;
  }
}
function MarkLabel({ label, look, fx }) {
  if (!look) return <span className="payout-k">{label}</span>;
  return (
    <span className={`payout-k payout-mark rarity-chip ${rarityClass(look.tier)}`}>
      {label}
      {fx ? <RarityFx tier={look.tier} /> : null}
    </span>
  );
}

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
  // less-is-more (Andy oct3): the base always reads "BASE …" first, then the named multipliers —
  // "BASE 10 / LETTER × 5 LETTERS ×2 MODE …". Same two terms, same product, the word BASE on it.
  // PROGRESSION v11 (amended): the receipt is a WINS receipt (words pay wins only), so the base is in
  // WINS — `perLetter` arrives as KEY's XP-units per letter (wins = ÷ 10): "BASE 1 WINS / LETTER × 5
  // LETTERS ×2 MODE" multiplies out to the +10 WINS headline, and never reads like the bar's
  // "BASE 10 XP / LETTER".
  // REBIRTH RUSH: the base is said the way the formula is — "BASE 10 WINS × 7/5 LETTERS" (BASE 10 WINS a
  // 5-letter word, scaled by length). `perLetter` is the wins basis of one letter in XP units (÷10 = wins),
  // so ×5 ÷ 10 is the BASE for 5 letters.
  const look = rows.some((r) => r.key === 'bonus') ? wornMarkLook() : null;
  const baseTerm = payout.letters && payout.perLetter
    ? `BASE ${formatRate(payout.perLetter / 2)} WINS × ${formatNum(payout.letters)}/5 ${payout.letters === 1 ? 'LETTER' : 'LETTERS'}`
    : `BASE ${formatRate(payout.base)} WINS / WORD`;
  return (
    <div className={`payout${compact ? ' payout--compact' : ''}`} aria-label="Payout breakdown">
      {/* WINS ONLY (PROGRESSION v11, amended): a game word pays wins; the level bar fills from LETTERS
          typed (BASE 10 XP / LETTER), so the receipt has no XP line. The headline is the wins the
          math below multiplies out to. */}
      <div className="payout-headline">
        <span className="payout-headline-wins">+{formatRate(payout.paid)}<span className="payout-headline-unit"> WINS</span></span>
      </div>
      {/* EVERY TERM, IN ORDER, ON ONE LINE. A vertical list of label/value pairs read as a table
          of unrelated facts; the product is a single sentence and now looks like one. */}
      <div className="payout-math">
        <span className="payout-term payout-term--base">{baseTerm}</span>
        {rows.map((r) => (
          <span key={r.key} className={`payout-term payout-term--${r.kind}`}>
            {r.key === 'bonus' ? <MarkLabel label={r.label} look={look} fx={!compact} /> : <span className="payout-k">{r.label}</span>}
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
// STEP 53 / Andy N4 ("cut the end-game WHERE YOUR WINS CAME FROM breakdown down"): the biggest
// three contributors keep their rows; everything smaller folds into ONE "+ n MORE" row, so the
// panel is three lines and a total, never a table. The folded row's wins are the exact sum of what
// it folds, so the rows still add up to the total.
const ROUND_ROWS_SHOWN = 3;
export function RoundPayout({ ledger }) {
  if (!ledger || !ledger.words) return null;
  const top = ledger.rows.length ? ledger.rows[0].share : 1;
  const shown = ledger.rows.slice(0, ROUND_ROWS_SHOWN);
  const look = shown.some((r) => r.key === 'bonus') ? wornMarkLook() : null;
  const rest = ledger.rows.slice(ROUND_ROWS_SHOWN);
  return (
    <div className="payout payout--round" aria-label="Where your wins came from">
      <div className="payout-title">WHERE YOUR WINS CAME FROM</div>
      <div className="payout-head">
        <span className="payout-head-label">BASE · {formatNum(ledger.words)} {ledger.words === 1 ? 'WORD' : 'WORDS'}</span>
        <span className="payout-head-val"><Num value={ledger.base} /></span>
      </div>
      {ledger.rows.length === 0 ? (
        <div className="payout-none">NO MULTIPLIERS THIS ROUND</div>
      ) : (
        <div className="payout-rows">
          {shown.map((r) => (
            <div key={r.key} className={`payout-row payout-row--${r.kind}`}>
              {r.key === 'bonus' ? <MarkLabel label={r.label} look={look} fx /> : <span className="payout-k">{r.label}</span>}
              {/* Width is a share of the BIGGEST row, not of 100%, so the smallest contributor is
                  still a visible bar rather than a sliver that reads as zero. */}
              <span className="payout-bar" style={{ '--w': pct(top > 0 ? r.share / top : 0) }} />
              <span className="payout-avg">{mult(r.mult)}</span>
              <Num value={r.wins} prefix="+" className="payout-v" />
            </div>
          ))}
          {rest.length > 0 && (
            <div className="payout-row payout-row--more">
              <span className="payout-k">+ {rest.length} MORE</span>
              <span className="payout-bar" style={{ '--w': '0%' }} />
              <span className="payout-avg" />
              <Num value={rest.reduce((a, r) => a + r.wins, 0)} prefix="+" className="payout-v" />
            </div>
          )}
        </div>
      )}
      {/* END-OF-ROUND BONUSES (O12): never folded into "+ n MORE" — a WINNER bonus is the round's
          headline, not a long-tail factor. */}
      {(ledger.bonuses || []).map((b) => (
        <div key={b.key}>
          <div className="payout-row payout-row--bonus">
            <span className="payout-k">{b.label}</span>
            <span className="payout-bar" style={{ '--w': '0%' }} />
            <span className="payout-avg">{mult(b.mult)}</span>
            <Num value={b.wins} prefix="+" className="payout-v" />
          </div>
          {/* H4: WHY the winner bonus is this size — a gate fell back to the old +50%, or a cap
              trimmed it. A smaller-than-advertised bonus must say so on the receipt. */}
          {b.note && <div className="payout-bonus-note">{b.note}</div>}
        </div>
      ))}
      <div className="payout-total">
        <span className="payout-k">TOTAL</span>
        <Num value={ledger.total} className="payout-total-val" />
      </div>
    </div>
  );
}
