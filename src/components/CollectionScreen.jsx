// CollectionScreen.jsx — the WORD COLLECTION (Job 3). A read-only overlay (same register as
// StatsScreen: flat #1a0b2e panel, thick black border, hard offset shadow, ZERO animation, scrolls
// internally). Shows total distinct words, a per-TIER breakdown, milestone progress, and your rarest
// finds listed with the ACTUAL words — never a word you haven't personally typed.
import { useEffect, useRef } from 'react';
import './CollectionScreen.css';
import { collectionSummary, TIERS, TIER_COLORS } from '../progress/collection';
import { formatNum } from '../format';

const MODE_LABEL = { 'word-bomb': 'WORD BOMB', 'category-blitz': 'BLITZ', 'sat-rush': 'SAT RUSH', chain: 'CHAIN', fuse: 'FUSE' };
const DAY_MS = 86400000;
function dayLabel(day) {
  try {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function CollectionScreen({ onBack }) {
  const overlayRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    overlayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sum = collectionSummary(60);
  const next = sum.nextMilestone;
  const prevClaimed = sum.milestones.filter((m) => sum.total >= m.n).map((m) => m.n);
  const lastClaimed = prevClaimed.length ? prevClaimed[prevClaimed.length - 1] : 0;
  const milestoneFrac = next ? Math.max(0, Math.min(1, (sum.total - lastClaimed) / (next.n - lastClaimed))) : 1;

  return (
    <div className="coll-overlay" role="dialog" aria-modal="true" aria-label="Word Collection" tabIndex={-1} ref={overlayRef}>
      <div className="coll-panel">
        <div className="coll-header">
          <h2 className="coll-title">COLLECTION</h2>
          <button type="button" className="coll-close" onClick={onBack} aria-label="Back to menu">✕</button>
        </div>

        <div className="coll-body">
          {/* Headline: distinct words + progress to the next milestone. */}
          <div className="coll-total">
            <span className="coll-total-num">{formatNum(sum.total)}</span>
            <span className="coll-total-label">DISTINCT WORDS COLLECTED</span>
          </div>

          {next ? (
            <div className="coll-milestone">
              <div className="coll-milestone-track">
                <div className="coll-milestone-fill" style={{ width: `${(milestoneFrac * 100).toFixed(1)}%` }} />
              </div>
              <div className="coll-milestone-label">
                {formatNum(next.n - sum.total)} TO {formatNum(next.n)} · +{formatNum(next.wins)} WINS
              </div>
            </div>
          ) : (
            <div className="coll-milestone-label coll-milestone-done">ALL MILESTONES CLAIMED — {formatNum(sum.cap)} CAP</div>
          )}

          {/* Per-tier grid. */}
          <h3 className="coll-subtitle">BY TIER</h3>
          <div className="coll-tiers">
            {TIERS.map((t) => (
              <div className="coll-tier" key={t} style={{ borderColor: TIER_COLORS[t] }}>
                <span className="coll-tier-count" style={{ color: TIER_COLORS[t] }}>{formatNum(sum.byTier[t] || 0)}</span>
                <span className="coll-tier-name">{t}</span>
              </div>
            ))}
          </div>

          {/* Rarest finds — the actual words the player typed (RARE + OBSCURE), newest first. */}
          <h3 className="coll-subtitle">RAREST FINDS</h3>
          {sum.rarest.length === 0 ? (
            <p className="coll-empty">No RARE or OBSCURE words yet. Play a mode and type something obscure — SAT RUSH is the fast track.</p>
          ) : (
            <ul className="coll-finds">
              {sum.rarest.map((f) => (
                <li className="coll-find" key={f.word}>
                  <span className="coll-find-word" style={{ color: TIER_COLORS[f.tier] }}>{f.word.toUpperCase()}</span>
                  <span className="coll-find-meta">
                    <span className="coll-find-tier" style={{ color: TIER_COLORS[f.tier] }}>{f.tier}</span>
                    {' · '}{MODE_LABEL[f.mode] || f.mode}{' · '}{dayLabel(f.day)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Milestone ladder. */}
          <h3 className="coll-subtitle">MILESTONES</h3>
          <dl className="coll-milestones-list">
            {sum.milestones.map((m) => {
              const done = sum.total >= m.n;
              return (
                <div className={`coll-ms-row${done ? ' is-done' : ''}`} key={m.n}>
                  <dt>{done ? '✓ ' : ''}{formatNum(m.n)} WORDS</dt>
                  <dd>+{formatNum(m.wins)} WINS</dd>
                </div>
              );
            })}
          </dl>
        </div>

        <button type="button" className="coll-back" onClick={onBack}>← BACK TO MENU</button>
      </div>
    </div>
  );
}
