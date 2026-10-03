// RollReveal.jsx — the MARK ROLL reveal ("spin", Andy H3; the oct3 review's hybrid). A FIXED POOL of nodes,
// mounted once with the MARKS panel: the face-down coin, the result card, a flash plate, and the cutscene layer
// (portalled into the MARKS overlay — it joins that layer, it is not a new fixed element). Each roll fills the
// pool and plays revealTimelines.js on it with WAAPI.
//
// RULES (CLAUDE.md ANIMATION BUDGET): finite one-shots only, transform/opacity only, will-change ON while a
// reveal plays and OFF when it ends, no layout reads anywhere. REDUCED MOTION: no animation — the result card
// shows at once, and an EPIC / LEGENDARY still gets its plate (tier, art, name, "1 IN X") as a STATIC frame for
// the same hold, so rarity still reads.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MarkBadge from '../MarkBadge';
import { MARK_TIERS } from '../../progress/marks';
import { markEntry } from '../../progress/markRolls';
import { timeline, LADDER } from './revealTimelines.js';
import { revealMs, isHeavy } from './revealPlan.js';
import { formatNum } from '../../format';

const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());
const tierColour = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].colour : '#9A1AFF');

export default function RollReveal({ seq, skipSeq, result, card, reduced, coverHost }) {
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
        staticTimer.current = setTimeout(endStatic, revealMs(result.tier));
      }
      return;
    }
    const touched = new Set();
    for (const s of timeline(result.tier)) {
      const el = nodes.current[s.node];
      if (!el || typeof el.animate !== 'function') continue;
      if (!touched.has(el)) { el.style.willChange = 'transform, opacity'; touched.add(el); }
      anims.current.push(el.animate(s.frames, { delay: s.delay, duration: Math.max(1, s.duration), easing: s.easing || 'linear', fill: 'both' }));
    }
    const mine = anims.current;
    if (mine.length) Promise.all(mine.map((a) => a.finished)).then(() => { if (anims.current === mine) stopAll(); }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
  // SKIP — a tap mid-reveal jumps straight to the rest state (the result card)
  useLayoutEffect(() => {
    if (!skipSeq) return;
    stopAll();
    endStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSeq]);
  useEffect(() => () => { stopAll(); if (staticTimer.current) clearTimeout(staticTimer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tier = result ? result.tier : 'common';
  const m = result ? markEntry(result.markId) : null;
  const below = Math.max(0, LADDER.indexOf(tier));
  const cover = (
    <div className={`mr-cover${staticCover ? ' is-static' : ''}`} ref={reg('cover')} aria-hidden="true" style={{ '--mr-tier': tierColour(tier) }}>
      <div className="mr-cover-plate" />
      <div className="mr-cover-page mr-cover-ladder" ref={reg('ladder')}>
        {LADDER.slice(0, 3).map((t, i) => (
          <div key={t} className={`mr-bar${i < below ? '' : ' is-off'}`} ref={reg(`bar${i}`)} style={{ '--mr-bar': tierColour(t) }}>{tierName(t)}</div>
        ))}
      </div>
      <div className="mr-cover-page mr-cover-final" ref={reg('final')}>{tierName(tier)}</div>
      <div className="mr-cover-page mr-cover-show">
        <div className="mr-show" ref={reg('show')}>
          <MarkBadge mark={m} size={140} className="mr-show-art" />
          <div className="mr-show-tier">{tierName(tier)}</div>
          <div className="mr-show-name">{m ? m.name : ''}</div>
        </div>
        <div className="mr-cover-stamp" ref={reg('stamp')}>{result ? `1 IN ${formatNum(result.oneInX)}` : ''}</div>
      </div>
    </div>
  );
  return (
    <div className={`mr-stage${result ? '' : ' is-empty'}`} style={{ '--mr-tier': tierColour(tier) }} data-tier={result ? tier : undefined}>
      <div className="mr-flash" ref={reg('flash')} aria-hidden="true" />
      <div className="mr-back" ref={reg('back')} aria-hidden="true">
        <MarkBadge mark={null} locked size={72} />
      </div>
      <div className="mr-card-slot" ref={reg('card')}>{card}</div>
      {coverHost ? createPortal(cover, coverHost) : null}
    </div>
  );
}
