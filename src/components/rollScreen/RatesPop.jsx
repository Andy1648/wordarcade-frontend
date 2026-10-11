// RatesPop.jsx — the ROLL screen's RATES (gear card v4, Andy oct11: "no need to show rates for the roll screen (have a
// rate icon … popup)"). A small RATES button in the options cluster; tapping it opens the odds of YOUR NEXT ROLL per tier
// ("1 IN 98"), read from the SAME table the roll uses (markRolls.rollTable with your luck, pity and bonus roll) — so the
// popup can never claim odds the roll does not have. A pity-forced roll adds an "EPIC+ GUARANTEED" line.
import { useEffect, useRef, useState } from 'react';
import KitIcon from '../kit/KitIcon.jsx';
import '../kit/kitIconData.js'; // registers the LUCK icon (the menu's core set does not carry it)
import { rollTable, loadRollState, freshState, permanentOwnedCount, ROLL_MARKS, ROLLABLE_TIERS } from '../../progress/markRolls.js';
import { isBoostActive } from '../../progress/boost';
import { CARD_RAR, cardTier } from '../markCard/palette.js';
import { MARK_TIERS } from '../../progress/marks';
import { formatNum, formatRate } from '../../format';

/** The per-tier odds of the next roll: { rows: [{ tier, name, line, oneIn, pct }], forced (tier | null) }. */
export function nextRollRates(state = loadRollState() || freshState(), ctx = { permanentOwned: permanentOwnedCount(), boost: isBoostActive() }) {
  const t = rollTable(state, ctx);
  const rows = ROLLABLE_TIERS.map((tier) => {
    const mass = ROLL_MARKS.filter((m) => m.tier === tier).reduce((s, m) => s + (t.probs.get(m.id) || 0), 0);
    return {
      tier,
      name: MARK_TIERS[tier] ? MARK_TIERS[tier].name : tier.toUpperCase(),
      line: CARD_RAR[cardTier(tier)].line,
      oneIn: mass > 0 ? Math.max(1, Math.round(1 / mass)) : 0,
      pct: mass * 100,
    };
  });
  return { rows, forced: t.forced || null };
}

export default function RatesPop() {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState({ rows: [], forced: null });
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    setRates(nextRollRates());
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <>
      <button type="button" className="rs-rates-btn" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Roll rates" data-testid="roll-rates">
        <KitIcon name="luck" size={26} shadow={1} extras={false} />
        <span className="rs-rates-k">RATES</span>
      </button>
      {open ? (
        <div className="rs-rates-scrim" role="presentation" onClick={() => setOpen(false)}>
          <div className="rs-rates" role="dialog" aria-modal="true" aria-label="Your next roll's odds" data-testid="roll-rates-pop" onClick={(e) => e.stopPropagation()}>
            <button ref={closeRef} type="button" className="rs-rates-x" onClick={() => setOpen(false)} aria-label="Close rates">✕</button>
            <div className="rs-rates-head">
              <KitIcon name="luck" size={34} shadow={2} extras={false} />
              <span>YOUR NEXT ROLL</span>
            </div>
            <ul className="rs-rates-list">
              {rates.rows.map((r) => (
                <li key={r.tier} className="rs-rates-row" style={{ '--rs-tier': r.line }} data-tier={r.tier}>
                  <span className="rs-rates-tier">{r.name}</span>
                  <span className="rs-rates-odds">
                    {/* a common tier reads as a percent ("98.6%" — never "1 IN 1"), a rarer one as 1 IN X */}
                    {!r.oneIn ? '—' : r.pct >= 10 ? `${formatRate(r.pct)}%` : <><span className="rs-rates-pre">1 IN</span> {formatNum(r.oneIn)}</>}
                  </span>
                </li>
              ))}
            </ul>
            {rates.forced ? <div className="rs-rates-pity" style={{ '--rs-tier': CARD_RAR[cardTier(rates.forced)].line }}>{(MARK_TIERS[rates.forced] || { name: rates.forced }).name}+ GUARANTEED</div> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
