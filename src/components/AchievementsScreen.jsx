// AchievementsScreen.jsx — the achievements grid (Job 7). Read-only content, StatsScreen register.
// Locked entries render as dim silhouettes showing their hint; SECRET entries show only "???" until
// earned. Grouped by category.
//
// NOTE: no longer a standalone overlay. ACHIEVEMENTS was consolidated INTO the Stats overlay as a tab
// (same kind of thing as records/progression), so this file exports only the BODY content
// (`AchievementsBody`) which StatsScreen renders inside its shared panel. The old menu footer link +
// `achievements` view were removed — see StatsScreen.jsx.
import './AchievementsScreen.css';
import { achievementList, achievementCounts } from '../progress/achievements';
import { formatNum } from '../format';

const CAT_ORDER = ['VOLUME', 'SPEED', 'VOCABULARY', 'PROGRESSION', 'STREAKS', 'MODES', 'ECONOMY', 'SECRET'];

// The ACHIEVEMENTS tab body — rendered inside the Stats overlay's shared scroll region.
export function AchievementsBody() {
  const list = achievementList();
  const counts = achievementCounts();
  const byCat = {};
  for (const a of list) (byCat[a.cat] = byCat[a.cat] || []).push(a);

  return (
    <>
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
    </>
  );
}
