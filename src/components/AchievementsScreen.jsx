// AchievementsScreen.jsx — the achievements grid (Job 7). Read-only overlay (StatsScreen register).
// Locked entries render as dim silhouettes showing their hint; SECRET entries show only "???" until
// earned. Grouped by category. Reached from an ACHIEVEMENTS menu footer link.
import { useEffect, useRef } from 'react';
import './AchievementsScreen.css';
import { achievementList, achievementCounts } from '../progress/achievements';
import { formatNum } from '../format';

const CAT_ORDER = ['VOLUME', 'SPEED', 'VOCABULARY', 'PROGRESSION', 'STREAKS', 'MODES', 'ECONOMY', 'SECRET'];

export default function AchievementsScreen({ onBack }) {
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

  const list = achievementList();
  const counts = achievementCounts();
  const byCat = {};
  for (const a of list) (byCat[a.cat] = byCat[a.cat] || []).push(a);

  return (
    <div className="ach-overlay" role="dialog" aria-modal="true" aria-label="Achievements" tabIndex={-1} ref={overlayRef}>
      <div className="ach-panel">
        <div className="ach-header">
          <h2 className="ach-title">ACHIEVEMENTS</h2>
          <button type="button" className="ach-close" onClick={onBack} aria-label="Back to menu">✕</button>
        </div>
        <div className="ach-body">
          <div className="ach-progress">{counts.earned} / {counts.total} EARNED</div>
          {CAT_ORDER.filter((c) => byCat[c]).map((cat) => (
            <div key={cat} className="ach-cat">
              <h3 className="ach-cat-title">{cat === 'SECRET' ? 'SECRET' : cat}</h3>
              <div className="ach-grid">
                {byCat[cat].map((a) => (
                  <div key={a.id} className={`ach-card${a.earned ? ' is-earned' : ''}${a.secret ? ' is-secret' : ''}`}>
                    <div className="ach-card-name">{a.name}</div>
                    <div className="ach-card-hint">{a.hint}</div>
                    <div className="ach-card-wins">{a.earned ? '✓ ' : ''}+{formatNum(a.base)} WINS</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="ach-back" onClick={onBack}>← BACK TO MENU</button>
      </div>
    </div>
  );
}
