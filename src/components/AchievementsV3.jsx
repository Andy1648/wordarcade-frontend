// AchievementsV3.jsx — ACHIEVEMENTS (PROGRESSION v3, SEASON2 only; claude/mockups/v2/Achievements.dc.html).
// "Every claim lives in ACHIEVEMENTS and pays gems" (Andy phase 3): the menu shows no claim popups, the player opens
// this screen and claims tier by tier. FUNCTIONAL and close to the mockup — the hero panel (READY / ALMOST, its
// ladder, one big CLAIM), the tile grid (strip, glyph, have / need, bar, CLAIM or tier pips) and the gem pill. The
// full kit restyle is a later visual PR. Glyphs are the mockup's vector art as files (/public/ach/*.svg — art is an
// asset, never CSS). Motion: finite one-shots only (rise, stamp, pop) on transform / opacity; nothing loops at rest.
// The data and the claim are v3/achievements.js (gems through gemsCore.grantGems).
import { useEffect, useRef, useState } from 'react';
import './AchievementsV3.css';
import { achievementsV3, claimAchievementV3, tierCountsV3, ROMAN } from '../progress/v3/achievements';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';

const TC = ['#A9B4C8', '#3D8BFF', '#B04BFF', '#FFC23D', '#FF3D7F'];
const TF = ['#262b38', '#0f2350', '#2a0e4a', '#3d2a05', '#4a0a22'];
const glyph = (g) => `/ach/${g}.svg`;

function sortRows(rows) {
  const k = (r) => (r.ready ? 0 : r.maxed ? 2 : 1);
  return rows.slice().sort((a, b) => k(a) - k(b) || b.pct - a.pct);
}

function Gem({ size = 18 }) {
  return <img className="av3-gem" src={glyph('gem')} width={size} height={size} alt="" aria-hidden="true" />;
}

function Badge({ r, size }) {
  const t = Math.min(r.tier, r.tiers - 1);
  return (
    <div className={`av3-badge av3-badge--${size}`} style={{ '--tc': TC[t], '--tf': TF[t] }}>
      <div className="av3-badge-plate" aria-hidden="true" />
      <img className="av3-badge-glyph" src={glyph(r.g)} alt="" aria-hidden="true" />
      <div className="av3-badge-roman">{r.maxed ? 'MAX' : ROMAN[t]}</div>
    </div>
  );
}

function Bar({ pct, ready, maxed }) {
  return (
    <div className="av3-bar" aria-hidden="true">
      <div className={`av3-bar-fill${maxed ? ' is-max' : ready ? ' is-ready' : pct >= 55 ? ' is-almost' : ''}`} style={{ transform: `scaleX(${Math.max(0, Math.min(1, pct / 100))})` }} />
    </div>
  );
}

export default function AchievementsV3({ onClose }) {
  const [rows, setRows] = useState(() => achievementsV3());
  const [counts, setCounts] = useState(() => tierCountsV3());
  const [gems, setGems] = useState(() => getGems());
  const [stamp, setStamp] = useState(null); // { id, key, gems, next }
  const [pop, setPop] = useState(0);
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => subscribeGems(setGems), []);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!stamp) return undefined;
    const t = setTimeout(() => setStamp(null), 900);
    return () => clearTimeout(t);
  }, [stamp]);

  const claim = (id) => {
    const res = claimAchievementV3(id);
    if (!res.ok) return;
    const next = achievementsV3();
    const row = next.find((r) => r.id === id);
    setRows(next);
    setCounts(tierCountsV3());
    setPop((n) => n + 1);
    setStamp({ id, key: Date.now(), gems: res.gems, next: row && !row.maxed ? `${ROMAN[row.tier]} · ${formatNum(row.need)}` : 'MAXED' });
  };

  const sorted = sortRows(rows);
  const ready = rows.filter((r) => r.ready);
  const hero = ready[0] || sorted.find((r) => !r.maxed) || sorted[0];
  const heroReady = hero && hero.ready;
  const nameOf = (r) => (r.tagNum ? `${r.name} ${formatNum(r.need)}` : r.name);

  return (
    <div className="av3-overlay" role="dialog" aria-modal="true" aria-label="Achievements" tabIndex={-1} ref={ref}>
      <div className="av3-screen">
        <header className="av3-head">
          <button type="button" className="av3-back" onClick={onClose} aria-label="Back to menu">← MENU</button>
          <h2 className="av3-title">ACHIEVEMENTS</h2>
          <div className="av3-tiers" aria-label={`${counts.done} of ${counts.all} tiers`}>
            <b>{formatNum(counts.done)}</b><span>/{formatNum(counts.all)}</span><small>TIERS</small>
          </div>
          <div key={`g${pop}`} className={`av3-gems${pop ? ' is-pop' : ''}`} aria-label={`${formatNum(gems)} gems`}>
            <Gem size={26} />
            <b>{formatNum(gems)}</b>
          </div>
        </header>

        <div className="av3-body">
          {hero && (
            <section className={`av3-hero${heroReady ? ' is-ready' : ''}`} style={{ '--tc': TC[Math.min(hero.tier, hero.tiers - 1)] }} aria-label="Next achievement">
              <div className="av3-hero-top">
                <span className={`av3-hero-label${heroReady ? ' is-ready' : ''}`}>{stamp && stamp.id === hero.id ? 'NICE' : heroReady ? 'READY' : 'ALMOST'}</span>
                <span className={`av3-ready-n${ready.length ? ' is-on' : ''}`} aria-label={`${ready.length} ready`}>{formatNum(ready.length)}</span>
              </div>
              <Badge r={hero} size="big" />
              <div className="av3-hero-name">{nameOf(hero)}</div>
              <div className="av3-hero-nums">
                <span className={`av3-have${hero.ready ? ' is-ready' : ''}`}>{formatNum(hero.have)}</span>
                <span className="av3-need">/ {formatNum(hero.need)}</span>
                <span className="av3-hero-reward"><Gem size={28} />+{formatNum(hero.reward)}</span>
              </div>
              <ol className="av3-ladder" aria-label="Tiers">
                {hero.T.map((n, i) => {
                  const done = i < hero.tier || hero.maxed;
                  const cur = i === hero.tier && !hero.maxed;
                  return (
                    <li key={i} className={`av3-step${done ? ' is-done' : cur ? ' is-cur' : ''}`} style={{ '--tc': TC[i], '--tf': TF[i] }}>
                      <span>{ROMAN[i]}</span><b>{formatNum(n)}</b>
                    </li>
                  );
                })}
              </ol>
              <div className="av3-hero-foot">
                {heroReady ? (
                  <button type="button" className="av3-claim av3-claim--big" onClick={() => claim(hero.id)}>
                    CLAIM <Gem size={30} /> {formatNum(hero.reward)}
                  </button>
                ) : (
                  <div className="av3-hero-bar">
                    <Bar pct={hero.pct} ready={false} maxed={hero.maxed} />
                    <span className="av3-hero-pct">{Math.floor(hero.pct)}%{hero.maxed ? '' : ` −${formatNum(Math.max(0, hero.need - hero.have))}`}</span>
                  </div>
                )}
              </div>
              {stamp && stamp.id === hero.id && (
                <div key={stamp.key} className="av3-stamp av3-stamp--big" aria-hidden="true"><b>CLAIMED</b><span>NEXT {stamp.next}</span></div>
              )}
            </section>
          )}

          <ul className="av3-grid">
            {sorted.map((r, i) => {
              const t = Math.min(r.tier, r.tiers - 1);
              const stamping = stamp && stamp.id === r.id;
              return (
                <li key={r.id} className={`av3-tile${r.ready ? ' is-ready' : ''}${r.maxed ? ' is-max' : ''}`} style={{ '--tc': TC[t], '--i': i }} data-ach={r.id}>
                  <div className="av3-strip">
                    <span>{r.maxed ? 'MAXED' : r.ready ? 'READY!' : `TIER ${ROMAN[t]}`}</span>
                    {!r.maxed && <span className="av3-strip-reward"><Gem size={16} />{formatNum(r.reward)}</span>}
                  </div>
                  <div className="av3-tile-body">
                    <div className="av3-tile-row">
                      <Badge r={r} size="small" />
                      <div className="av3-tile-nums">
                        <span className={`av3-have${r.ready ? ' is-ready' : ''}`}>{formatNum(r.have)}</span>
                        <span className="av3-need">/ {formatNum(r.need)}</span>
                      </div>
                    </div>
                    <div className="av3-tile-name">{nameOf(r)}</div>
                    <Bar pct={r.pct} ready={r.ready} maxed={r.maxed} />
                    <div className="av3-tile-foot">
                      {r.ready ? (
                        <button type="button" className="av3-claim" onClick={() => claim(r.id)} aria-label={`Claim ${r.name} for ${r.reward} gems`}>
                          CLAIM <Gem size={18} /> {formatNum(r.reward)}
                        </button>
                      ) : (
                        <>
                          <span className="av3-pips" aria-hidden="true">
                            {r.T.map((_, k) => <i key={k} style={k < r.tier || r.maxed ? { background: TC[k] } : null} />)}
                          </span>
                          <span className={`av3-pct${r.pct >= 55 && !r.maxed ? ' is-almost' : ''}`}>{Math.floor(r.pct)}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  {stamping && (
                    <div key={stamp.key} className="av3-stamp" aria-hidden="true"><b>CLAIMED</b><span>+{formatNum(stamp.gems)} · NEXT {stamp.next}</span></div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
