// AchievementsV3.jsx — ACHIEVEMENTS (PROGRESSION v3, SEASON2 only; claude/mockups/v2/Achievements.dc.html, P3).
// "Every claim lives in ACHIEVEMENTS and pays gems" (Andy phase 3): THIS SCREEN IS THE ONLY CLAIM PLACE — the menu shows
// no claim popups; the player opens it from the menu's ACHIEVEMENTS trophy (S2Trophy, lazy) and claims tier by tier.
//
// Built from the v2 kit on the real v3 model (v3/achievements.js — counters, tiers I–V, gems 40–200 through
// gemsCore.grantGems):
//   * header: KitBackButton · ACHIEVEMENTS · the TIERS chip · the GEMS KitPill (the fly target);
//   * HERO next-claim panel: READY / ALMOST / NICE, the ready count, the badge (tier plate + the glyph asset + roman),
//     have / need, +gems, the I–V ladder, then one big CLAIM (KitButton) — or the % bar when nothing is ready;
//   * the 4 × 2 GRID: one KitStampCard per achievement (strip, badge, have / need, name, bar, CLAIM or tier pips);
//   * CLAIM pays the gems ONCE (claimAchievementV3 — one tier per call; a 2nd tap on a stamped tile does nothing), the
//     tile is stamped CLAIMED (kit stamp), and the gems FLY to the counter (KitFlyLayer — pooled nodes): the pill
//     counts up as each one lands. MAXED tiles carry the kit MAX stamp.
// Glyphs are the mockup's vector art as files (/public/ach/*.svg — art is an asset, never CSS). Motion: kit one-shots
// on transform / opacity; nothing loops at rest; REDUCE MOTION lands every gem at once (KitFlyLayer).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './AchievementsV3.css';
import { KitBackButton, KitButton, KitGhostButton, KitPill, KitStampCard, KitFlyLayer, KitIcon } from './kit/index.js';
import { achievementsV3, claimAchievementV3, tierCountsV3, ROMAN } from '../progress/v3/achievements';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { formatNum } from '../format';

const TC = ['#A9B4C8', '#3D8BFF', '#B04BFF', '#FFC23D', '#FF3D7F'];
const TF = ['#262b38', '#0f2350', '#2a0e4a', '#3d2a05', '#4a0a22'];
const glyph = (g) => `/ach/${g}.svg`;
const STAMP_MS = 1250; // the CLAIMED stamp holds the tile this long (the mockup's beat), then it shows the next tier
const FLY_PARTS = 6;

/** Ready (or being stamped) first, then by progress; maxed last. */
function sortRows(rows, stampId) {
  const k = (r) => (r.ready || r.id === stampId ? 0 : r.maxed ? 2 : 1);
  return rows.slice().sort((a, b) => k(a) - k(b) || b.pct - a.pct);
}
/** A reward split into FLY_PARTS gems that sum to it. */
function splitReward(n) {
  const share = Math.floor(n / FLY_PARTS);
  return Array.from({ length: FLY_PARTS }, (_, i) => (i === FLY_PARTS - 1 ? n - share * (FLY_PARTS - 1) : share));
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
      <div className={`av3-bar-fill${maxed ? ' is-max' : ready ? ' is-ready' : pct >= 55 ? ' is-almost' : ''}`} style={{ transform: `scaleX(${Math.max(0, Math.min(1, pct / 100)).toFixed(3)})` }} />
    </div>
  );
}

/** Big screens: the 1366×657 stage (the mockup's own size) scales up to fit — measured on mount / resize only. */
function useStageScale(ref) {
  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const k = w >= 700 ? Math.max(1, Math.min(w / 1366, window.innerHeight / 657)) : 1;
      if (ref.current) ref.current.style.setProperty('--av3-k', k.toFixed(4));
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
}

export default function AchievementsV3({ onClose }) {
  const [rows, setRows] = useState(() => achievementsV3());
  const [counts, setCounts] = useState(() => tierCountsV3());
  const [gems, setGems] = useState(() => getGems());
  const [inFlight, setInFlight] = useState(0); // gems paid but still flying: the pill shows them as they land
  const [stamp, setStamp] = useState(null); // { id, key, next }
  const ref = useRef(null);
  const pillRef = useRef(null);
  const flyRef = useRef(null);
  const stampingRef = useRef(null); // the id being stamped, set synchronously (a double click in one task pays once)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useStageScale(ref);

  useEffect(() => subscribeGems(setGems), []);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    if (!stamp) return undefined;
    const t = setTimeout(() => {
      stampingRef.current = null;
      setStamp(null);
    }, STAMP_MS);
    return () => clearTimeout(t);
  }, [stamp]);

  // CLAIM: one tier, paid once. `e` = the click (its point is where the gems burst from).
  const claim = (id, e) => {
    if (stampingRef.current === id) return; // the tile is still being stamped
    const res = claimAchievementV3(id);
    if (!res.ok) return;
    stampingRef.current = id;
    const next = achievementsV3();
    const row = next.find((r) => r.id === id);
    setRows(next);
    setCounts(tierCountsV3());
    setStamp({ id, key: Date.now(), next: row && !row.maxed ? `${ROMAN[row.tier]} · ${formatNum(row.need)}` : 'MAXED' });
    // the gems fly from the button to the counter; the pill counts each one in as it lands
    let from = null;
    if (e && e.clientX) from = { x: e.clientX, y: e.clientY };
    else if (e && e.currentTarget) {
      const b = e.currentTarget.getBoundingClientRect(); // a keyboard claim: one read, in the handler
      from = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    setInFlight((n) => n + res.gems);
    flyRef.current?.fly({ from, amounts: splitReward(res.gems), onLand: (a) => setInFlight((n) => Math.max(0, n - a)) });
  };

  const stampId = stamp ? stamp.id : null;
  const sorted = sortRows(rows, stampId);
  const ready = rows.filter((r) => r.ready && r.id !== stampId);
  const hero = (stampId && rows.find((r) => r.id === stampId)) || ready[0] || sorted.find((r) => !r.maxed) || sorted[0];
  const heroStamped = !!hero && hero.id === stampId;
  const heroReady = !!hero && hero.ready && !heroStamped;
  const nameOf = (r) => (r.tagNum ? `${r.name} ${formatNum(r.need)}` : r.name);
  const shownGems = Math.max(0, gems - inFlight);

  // PORTALED to <body> (like ModeDialog / LockedPreviewDialog): the trophy lives inside the menu's nav cluster, and a
  // fixed overlay left in there is trapped in the menu's stacking context (the menu's cards painted through it)
  return createPortal(
    <div className="av3-overlay" role="dialog" aria-modal="true" aria-label="Achievements" tabIndex={-1} ref={ref}>
      <div className="av3-stripes" aria-hidden="true" />
      <div className="av3-scale">
        <div className="av3-screen">
          <header className="av3-head">
            <KitBackButton label="MENU" ariaLabel="Back to menu" onClick={onClose} className="av3-back" />
            <h2 className="av3-title">ACHIEVEMENTS</h2>
            <div className="av3-tiers" aria-label={`${counts.done} of ${counts.all} tiers`}>
              <b>{formatNum(counts.done)}</b>
              <span>/{formatNum(counts.all)}</span>
              <small>TIERS</small>
            </div>
            <div className="av3-gems" data-gems={gems}>
              <KitPill ref={pillRef} kind="gems" value={shownGems} ariaLabel={`${formatNum(gems)} gems`} />
            </div>
          </header>

          <div className="av3-body">
            {hero && (
              <section className={`av3-hero${heroReady ? ' is-ready' : ''}${heroStamped ? ' is-stamped' : ''}`} style={{ '--tc': TC[Math.min(hero.tier, hero.tiers - 1)] }} aria-label="Next achievement" data-hero={hero.id}>
                <div className="av3-hero-top">
                  <span className={`av3-hero-label${heroReady || heroStamped ? ' is-ready' : ''}`}>{heroStamped ? 'NICE' : heroReady ? 'READY' : 'ALMOST'}</span>
                  <span className={`av3-ready-n${ready.length ? ' is-on' : ''}`} aria-label={`${ready.length} ready`}>
                    {formatNum(ready.length)}
                  </span>
                </div>
                <div className="av3-hero-main">
                  <Badge r={hero} size="big" />
                  <div className="av3-hero-name">{nameOf(hero)}</div>
                  <div className="av3-hero-nums">
                    <span className={`av3-have${hero.ready ? ' is-ready' : ''}`}>{formatNum(hero.have)}</span>
                    <span className="av3-need">/ {formatNum(hero.need)}</span>
                    {!hero.maxed && (
                      <span className="av3-hero-reward">
                        <KitIcon name="gems" size={30} shadow={2} extras={false} />+{formatNum(hero.reward)}
                      </span>
                    )}
                  </div>
                  <ol className="av3-ladder" aria-label="Tiers">
                    {hero.T.map((n, i) => {
                      const done = i < hero.tier || hero.maxed;
                      const cur = i === hero.tier && !hero.maxed;
                      return (
                        <li key={i} className={`av3-step${done ? ' is-done' : cur ? ' is-cur' : ''}`} style={{ '--tc': TC[i], '--tf': TF[i] }}>
                          <span>{ROMAN[i]}</span>
                          <b>{formatNum(n)}</b>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <div className="av3-hero-foot">
                  {heroReady ? (
                    <KitButton
                      tone="cyan"
                      className="av3-claim av3-claim--big"
                      label={<>CLAIM <KitIcon name="gems" size={30} shadow={2} extras={false} /> {formatNum(hero.reward)}</>}
                      labelSize={34}
                      width={330}
                      ariaLabel={`Claim ${hero.name} for ${hero.reward} gems`}
                      onClick={(e) => claim(hero.id, e)}
                    />
                  ) : (
                    <div className="av3-hero-bar">
                      <Bar pct={hero.pct} ready={false} maxed={hero.maxed} />
                      <span className="av3-hero-pct">
                        {heroStamped ? `NEXT ${stamp.next}` : `${Math.floor(hero.pct)}%${hero.maxed ? '' : ` −${formatNum(Math.max(0, hero.need - hero.have))}`}`}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <ul className="av3-grid">
              {sorted.map((r, i) => {
                const t = Math.min(r.tier, r.tiers - 1);
                const stamping = r.id === stampId;
                const isReady = r.ready && !stamping;
                return (
                  <li key={r.id} className={`av3-cell${isReady ? ' is-ready' : ''}${r.maxed ? ' is-max' : ''}`} style={{ '--tc': TC[t], '--i': i }} data-ach={r.id}>
                    <KitStampCard
                      stamped={stamping || r.maxed}
                      kind={stamping ? 'claimed' : 'max'}
                      playKey={stamping ? stamp.key : 0}
                      className="av3-tile"
                      at={stamping ? { left: '50%', top: '48%' } : { left: '70%', top: '42%' }}
                    >
                      <div className="av3-strip">
                        <span>{r.maxed && !stamping ? 'MAXED' : stamping ? 'CLAIMED' : isReady ? 'READY!' : `TIER ${ROMAN[t]}`}</span>
                        {!r.maxed && (
                          <span className="av3-strip-reward">
                            <KitIcon name="gems" size={16} shadow={1} extras={false} />
                            {formatNum(r.reward)}
                          </span>
                        )}
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
                          {isReady ? (
                            <KitGhostButton
                              tone="cyan"
                              className="av3-claim"
                              label="CLAIM"
                              count={`+${formatNum(r.reward)}`}
                              ariaLabel={`Claim ${r.name} for ${r.reward} gems`}
                              onClick={(e) => claim(r.id, e)}
                            />
                          ) : (
                            <>
                              <span className="av3-pips" aria-hidden="true">
                                {r.T.map((_, k) => (
                                  <i key={k} style={k < r.tier || r.maxed ? { background: TC[k] } : null} />
                                ))}
                              </span>
                              <span className={`av3-pct${r.pct >= 55 && !r.maxed ? ' is-almost' : ''}`}>{stamping ? `NEXT ${stamp.next}` : `${Math.floor(r.pct)}%`}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </KitStampCard>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
      <KitFlyLayer ref={flyRef} target={() => pillRef.current && pillRef.current.iconEl()} icon="gems" />
    </div>,
    document.body,
  );
}
