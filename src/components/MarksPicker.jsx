// MarksPicker.jsx — choose the ONE mark you wear.
//
// One slot, by design (see progress/marks.js): a mark is a decision, not a shelf of passive
// bonuses. So the picker is a list of cards where exactly one is lit, tapping a card equips it,
// and tapping the lit one takes it off — an empty slot is a legitimate choice and the UI has to
// let you get back to it.
//
// A LOCKED mark shows the achievement that unlocks it rather than a silhouette. A mark you cannot
// have is only interesting if you can go and get it; hiding which achievement it comes from would
// make the whole system read as random drops.
import { MARKS } from '../progress/marks';
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
        <p className="marks-intro">
          Earned from achievements, worn one at a time. The one you wear shows up in your payout
          breakdown every time it pays.
        </p>
        <div className="marks-grid">
          {MARKS.map((m) => {
            const have = unlocked.has(m.id);
            const on = equippedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`mark-card${on ? ' is-on' : ''}${have ? '' : ' is-locked'}`}
                disabled={!have}
                aria-pressed={on}
                onClick={() => onEquip && onEquip(on ? null : m.id)}
              >
                <span className="mark-icon" aria-hidden="true">{have ? m.icon : '🔒'}</span>
                <span className="mark-body">
                  <span className="mark-name">{m.name}</span>
                  <span className="mark-blurb">{m.blurb}</span>
                  {!have && (
                    <span className="mark-lock">
                      UNLOCKS WITH {achievementNames[m.from] || m.from}
                    </span>
                  )}
                </span>
                {on && <span className="mark-on" aria-hidden="true">WORN</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
