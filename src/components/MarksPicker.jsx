// MarksPicker.jsx — choose the ONE mark you wear.
//
// One slot, by design (see progress/marks.js): a mark is a decision, not a shelf of passive
// bonuses. So the picker is a list of cards where exactly one is lit, tapping a card equips it,
// and tapping the lit one takes it off — an empty slot is a legitimate choice and the UI has to
// let you get back to it.
//
// STEP 21 / A3: every mark is drawn art (MarkBadge) with a RANK. A worn mark grows I → V with the
// words you type in it; the card says what it pays at THIS rank, what the next rank pays, and how
// far away that is — so switching marks is a real decision, not a free toggle.
//
// A LOCKED mark shows the achievement that unlocks it rather than a silhouette. A mark you cannot
// have is only interesting if you can go and get it.
import { MARKS, MARK_RANK_NAMES, markProgress, markBlurbAt, markMainMult, markTier } from '../progress/marks';
import MarkBadge from './MarkBadge';
import { formatNum } from '../format';
import './MarksPicker.css';


export default function MarksPicker({ unlockedIds = [], equippedId = null, achievementNames = {}, onEquip, onClose }) {
  const unlocked = new Set(unlockedIds);
  return (
    <div className="marks-overlay" role="dialog" aria-modal="true" aria-label="Marks">
      <div className="marks-card">
        <div className="marks-head">
          <h2 className="marks-title">MARKS</h2>
          <button type="button" className="marks-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {/* STEP 49 (Andy oct2): ONE collection; the worn mark is your MAIN — your title — and it
            pays a real bonus on every word, more for rarer marks and at every rank. */}
        <p className="marks-intro">
          COLLECT MARKS FROM ACHIEVEMENTS. WEAR ONE AS YOUR MAIN: IT IS YOUR TITLE AND PAYS
          +100% (COMMON) TO +300% (LEGENDARY) ON EVERY WORD — MORE AT EVERY RANK.
        </p>
        <div className="marks-grid">
          {MARKS.map((m) => {
            const have = unlocked.has(m.id);
            const on = equippedId === m.id;
            const p = markProgress(m.id);
            const tier = markTier(m);
            const mainPct = Math.round((markMainMult(m, have ? p.rank : 1) - 1) * 100);
            return (
              <button
                key={m.id}
                type="button"
                className={`mark-card${on ? ' is-on' : ''}${have ? '' : ' is-locked'}`}
                style={{ '--tier': tier.colour }}
                disabled={!have}
                aria-pressed={on}
                onClick={() => onEquip && onEquip(on ? null : m.id)}
              >
                <MarkBadge mark={m} rank={p.rank} locked={!have} size={68} className="mark-art" />
                <span className="mark-body">
                  <span className="mark-name-row">
                    <span className="mark-name">{m.name}</span>
                    <span className="mark-tier">{tier.name}</span>
                    {have && <span className={`mark-rank r${p.rank}`}>RANK {MARK_RANK_NAMES[p.rank - 1]}</span>}
                  </span>
                  <span className="mark-main">+{mainPct}% WINS · EVERY MODE</span>
                  <span className="mark-blurb">+ {markBlurbAt(m, p.rank)}</span>
                  {have && !p.maxed && (
                    <>
                      <span className="mark-next">
                        RANK {MARK_RANK_NAMES[p.rank]}: +{Math.round((markMainMult(m, p.rank + 1) - 1) * 100)}% WINS</span>
                      <span className="mark-bar" aria-label={`${formatNum(p.into)} of ${formatNum(p.need)} words to rank ${MARK_RANK_NAMES[p.rank]}`}>
                        <span className="mark-bar-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, p.frac))})` }} />
                      </span>
                      <span className="mark-words">{formatNum(p.into)} / {formatNum(p.need)} WORDS WORN</span>
                    </>
                  )}
                  {have && p.maxed && <span className="mark-next">MAX RANK</span>}
                  {!have && (
                    <span className="mark-lock">
                      UNLOCKS WITH {achievementNames[m.from] || m.from}
                    </span>
                  )}
                </span>
                {on && <span className="mark-on" aria-hidden="true">MAIN</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
