// RollReveal.jsx — the MARK ROLL reveal (Andy oct3: rarity-scaled, tap to skip, ×10, SHINY). A FIXED POOL of
// nodes, mounted once with the MARKS panel: the stage (coin, result card, flash, the b rays, the c reel, the
// ×10 grid of ten tiles) and the cover layer — portalled INTO the MARKS overlay (a layer of that panel, never
// its own fixed element): dim sheet, rarity plate, pack halves (c), ray fan (b), reel (c), tier name, the mark,
// "1 IN X", and twelve pooled particles. Each roll fills the pool and plays revealTimelines.js on it with WAAPI.
//
// RULES (CLAUDE.md ANIMATION BUDGET): finite one-shots only, transform/opacity only, will-change ON while a
// reveal plays and OFF when it ends, no layout reads anywhere (the reel and particles move in % / fixed px).
// REDUCED MOTION: no animation — the result shows at once, and a LEGENDARY / MYTHIC / SECRET still gets its
// plate (tier, art, name, "1 IN X") as a STATIC frame for the same hold, so rarity still reads.
// Every shape here is an asset in /public/art/rolls (particles, rays, pack halves, the SHINY badge + streak).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MarkBadge from '../MarkBadge';
import { MARK_TIERS } from '../../progress/marks';
import { markEntry } from '../../progress/markRolls';
import { timeline, multiTimeline, LADDER, PARTICLES } from './revealTimelines.js';
import { revealMs, isHeavy, revealKind, multiPlan, MULTI_COUNT } from './revealPlan.js';
import { formatNum } from '../../format';

const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());
const tierColour = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].colour : '#9A1AFF');
const ART = '/art/rolls/';
const PARTICLE_ART = ['shard.svg', 'spark.svg', 'blob.svg'];
const SLOTS = Array.from({ length: MULTI_COUNT }, (_, i) => i);
const PARTS = Array.from({ length: PARTICLES }, (_, i) => i);
const REEL = [...LADDER, ...LADDER]; // two laps (revealTimelines.reelStop)

/** The SHINY badge: one small asset, no text. */
export function ShinyBadge({ className = '' }) {
  return <img className={`mr-shiny ${className}`} src={`${ART}shiny.svg`} alt="" aria-hidden="true" width="22" height="22" draggable="false" />;
}

export default function RollReveal({ seq, skipSeq, result, results = null, card, reduced, coverHost, version = 'a' }) {
  const nodes = useRef({});
  const anims = useRef([]);
  const staticTimer = useRef(null);
  const [staticCover, setStaticCover] = useState(false);
  const reg = (name) => (el) => { if (el) nodes.current[name] = el; };

  const stopAll = () => {
    for (const a of anims.current) { try { a.cancel(); } catch { /* gone */ } }
    anims.current = [];
    for (const el of Object.values(nodes.current)) if (el && el.style) el.style.willChange = '';
  };
  const endStatic = () => {
    if (staticTimer.current) clearTimeout(staticTimer.current);
    staticTimer.current = null;
    setStaticCover(false);
  };

  // PLAY — in a layout effect, so the first frame of the reveal is the frame the tap paints (<50 ms input)
  useLayoutEffect(() => {
    if (!seq || !result) return;
    stopAll();
    endStatic();
    if (reduced) {
      if (isHeavy(result.tier)) {
        setStaticCover(true);
        staticTimer.current = setTimeout(endStatic, results ? multiPlan(results).D : revealMs(result.tier));
      }
      return;
    }
    const steps = results ? multiTimeline(results, false, version) : timeline(result.tier, false, version, { shiny: !!result.shiny });
    const touched = new Set();
    for (const s of steps) {
      const el = nodes.current[s.node];
      if (!el || typeof el.animate !== 'function') continue;
      if (!touched.has(el)) { el.style.willChange = 'transform, opacity'; touched.add(el); }
      anims.current.push(el.animate(s.frames, { delay: s.delay, duration: Math.max(1, s.duration), easing: s.easing || 'linear', fill: 'both' }));
    }
    const mine = anims.current;
    if (mine.length) Promise.all(mine.map((a) => a.finished)).then(() => { if (anims.current === mine) stopAll(); }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
  // SKIP — a tap anywhere mid-reveal jumps straight to the rest state (the result card / the ×10 grid)
  useLayoutEffect(() => {
    if (!skipSeq) return;
    stopAll();
    endStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSeq]);
  useEffect(() => () => { stopAll(); if (staticTimer.current) clearTimeout(staticTimer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tier = result ? result.tier : 'common';
  const kind = revealKind(tier);
  const m = result ? markEntry(result.markId) : null;
  const multi = !!(results && results.length);
  const best = multi ? multiPlan(results).best : -1;
  const reelRows = (cls) => REEL.map((t, i) => (
    <div key={i} className={cls} style={{ '--mr-bar': tierColour(t) }}>{tierName(t)}</div>
  ));

  const cover = (
    <div
      className={`mr-cover is-${kind}${staticCover ? ' is-static' : ''}${result && result.shiny ? ' is-shiny' : ''}`}
      ref={reg('cover')}
      aria-hidden="true"
      data-v={version}
      data-tier={result ? tier : undefined}
      style={{ '--mr-tier': tierColour(tier) }}
    >
      <div className="mr-cover-dim" ref={reg('dim')} />
      <div className="mr-cover-plate" ref={reg('plate')} />
      <div className="mr-cover-rays" ref={reg('rays')}><div className="mr-rays-ink" /></div>
      <img className="mr-pack is-l" ref={reg('packL')} src={`${ART}pack-left.svg`} alt="" draggable="false" />
      <img className="mr-pack is-r" ref={reg('packR')} src={`${ART}pack-right.svg`} alt="" draggable="false" />
      <div className="mr-reel-win"><div className="mr-reel" ref={reg('reel')}>{reelRows('mr-reel-row')}</div></div>
      <div className="mr-cover-shake" ref={reg('cshake')}>
        <div className="mr-cover-final" ref={reg('final')}>{tierName(tier)}</div>
        <div className="mr-show" ref={reg('show')}>
          <span className="mr-show-artwrap">
            <MarkBadge mark={m} size={140} className="mr-show-art" />
            {result && result.shiny ? <ShinyBadge className="is-big" /> : null}
          </span>
          <div className="mr-show-name">{m ? m.name : ''}</div>
        </div>
        <div className="mr-cover-stamp" ref={reg('stamp')}>{result ? `1 IN ${formatNum(result.oneInX)}` : ''}</div>
      </div>
      <div className="mr-parts">
        {PARTS.map((i) => (
          <img key={i} className="mr-part" ref={reg(`p${i}`)} src={`${ART}${PARTICLE_ART[i % PARTICLE_ART.length]}`} alt="" draggable="false" />
        ))}
      </div>
    </div>
  );
  return (
    <div
      className={`mr-stage${result ? '' : ' is-empty'}${multi ? ' is-multi' : ''}`}
      style={{ '--mr-tier': tierColour(tier) }}
      data-tier={result ? tier : undefined}
      data-v={version}
    >
      <div className="mr-shake" ref={reg('shake')}>
        <div className="mr-flash" ref={reg('flash')} aria-hidden="true" />
        <div className="mr-srays" ref={reg('srays')} aria-hidden="true"><div className="mr-rays-ink" /></div>
        <div className="mr-sreel-win" aria-hidden="true"><div className="mr-sreel" ref={reg('sreel')}>{reelRows('mr-reel-row')}</div></div>
        <div className="mr-back" ref={reg('back')} aria-hidden="true">
          <MarkBadge mark={null} locked size={72} />
        </div>
        <div className={`mr-card-slot${result && result.shiny ? ' is-shiny' : ''}`} ref={reg('card')}>
          {card}
          <img className="mr-shine" ref={reg('shine')} src={`${ART}shimmer.svg`} alt="" aria-hidden="true" draggable="false" />
        </div>
        {/* ×10: ten pooled tiles — the best one gets its tier's reveal last */}
        <div className="mr-grid" data-testid="mark-roll-grid" aria-hidden={multi ? undefined : 'true'}>
          {SLOTS.map((i) => {
            const r = multi ? results[i] : null;
            const e = r ? markEntry(r.markId) : null;
            return (
              <div
                key={i}
                ref={reg(`m${i}`)}
                className={`mr-tile is-${r ? r.tier : 'none'}${r && r.shiny ? ' is-shiny' : ''}${i === best ? ' is-best' : ''}`}
                style={r ? { '--mr-tier': tierColour(r.tier) } : undefined}
                role={r ? 'img' : undefined}
                aria-label={r ? `${e ? e.name : ''}, ${tierName(r.tier)}` : undefined}
                data-testid={r ? 'mark-roll-tile' : undefined}
              >
                {r ? <MarkBadge mark={e} size={36} className="mr-tile-art" /> : null}
                {r && r.shiny ? <ShinyBadge /> : null}
              </div>
            );
          })}
        </div>
      </div>
      {coverHost ? createPortal(cover, coverHost) : null}
    </div>
  );
}
