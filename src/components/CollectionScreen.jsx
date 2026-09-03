// CollectionScreen.jsx — the WORD COLLECTION (Job 3). Read-only content, ZERO animation. Shows
// total distinct words, a per-TIER breakdown, milestone progress, and your rarest finds listed with
// the ACTUAL words — never a word you haven't personally typed.
//
// NOTE: this is no longer a standalone overlay. COLLECTION was consolidated INTO the Stats overlay
// as a tab (it is the same kind of thing as records/progression), so this file exports only the BODY
// content (`CollectionBody`) which StatsScreen renders inside its shared panel. The old menu footer
// link + `collection` view were removed — see StatsScreen.jsx.
import './CollectionScreen.css';
import { collectionSummary, TIERS, TIER_COLORS } from '../progress/collection';
import { readRecords } from '../progress/records';
import { rebirthScaledWins } from '../progress/xp';
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

// The COLLECTION tab body — rendered inside the Stats overlay's shared scroll region.
export function CollectionBody() {
  const sum = collectionSummary(60);
  // DISTINCT WORDS reads the SAME uncapped source as the Stats tab (records.seen) so the two
  // never disagree — the collection store itself caps at 5,000 (LRU), which used to leave this
  // headline pinned at 5,000 while Stats kept climbing. Below the cap the two are identical.
  const distinct = readRecords().distinct;
  const next = sum.nextMilestone;
  const prevClaimed = sum.milestones.filter((m) => sum.total >= m.n).map((m) => m.n);
  const lastClaimed = prevClaimed.length ? prevClaimed[prevClaimed.length - 1] : 0;
  const milestoneFrac = next ? Math.max(0, Math.min(1, (sum.total - lastClaimed) / (next.n - lastClaimed))) : 1;

  return (
    <>
          {/* Headline: distinct words + progress to the next milestone. */}
          <div className="coll-total">
            <span className="coll-total-num">{formatNum(distinct)}</span>
            <span className="coll-total-label">DISTINCT WORDS COLLECTED</span>
          </div>

          {next ? (
            <div className="coll-milestone">
              <div className="coll-milestone-track">
                <div className="coll-milestone-fill" style={{ width: `${(milestoneFrac * 100).toFixed(1)}%` }} />
              </div>
              <div className="coll-milestone-label">
                {formatNum(next.n - sum.total)} TO {formatNum(next.n)} · +{formatNum(rebirthScaledWins(next.wins))} WINS
              </div>
            </div>
          ) : (
            <div className="coll-milestone-label coll-milestone-done">ALL MILESTONES CLAIMED — {formatNum(sum.cap)} CAP</div>
          )}

          {/* Per-tier grid. */}
          <h3 className="coll-subtitle">BY RARITY</h3>
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
                  <dd>+{formatNum(rebirthScaledWins(m.wins))} WINS</dd>
                </div>
              );
            })}
          </dl>
    </>
  );
}
