// RollReveal.jsx — the MARK ROLL reveal ("spin", Andy H3). A FIXED POOL of nodes, mounted once with the
// MARKS panel: the face-down card, the result card, a flash plate, a 6-slot name reel, and a cutscene layer
// (portalled into the MARKS overlay — it joins that layer, it is not a new fixed element). Each roll fills
// the pool with text and plays revealTimelines.js on it with WAAPI.
//
// RULES (CLAUDE.md ANIMATION BUDGET): finite one-shots only, transform/opacity only, will-change ON while a
// reveal plays and OFF when it ends, no layout reads anywhere (nothing is measured — the reel moves in % of
// its own height). Reduced motion: no animation, the static result card holds for the same time.
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import MarkBadge from '../MarkBadge';
import { MARK_TIERS } from '../../progress/marks';
import { ROLL_MARKS } from '../../progress/markRolls';
import { timeline, REEL_SLOTS, BAR_TIERS } from './revealTimelines.js';

const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t || '').toUpperCase());
const tierColour = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].colour : '#9A1AFF');

/** The reel's six names: five decoys that climb toward the result's tier, then the result. */
export function reelNames(result, rnd = Math.random) {
  if (!result) return Array(REEL_SLOTS).fill('');
  const order = ['common', 'rare', 'epic', 'legendary'];
  const top = Math.max(0, order.indexOf(result.tier));
  const out = [];
  for (let i = 0; i < REEL_SLOTS - 1; i += 1) {
    const t = order[Math.min(top, Math.floor((i / (REEL_SLOTS - 1)) * (top + 1)))];
    const pool = ROLL_MARKS.filter((m) => m.tier === t && m.id !== result.markId);
    const m = pool[Math.floor(rnd() * pool.length)] || ROLL_MARKS[0];
    out.push({ name: m.name, tier: m.tier });
  }
  const self = ROLL_MARKS.find((m) => m.id === result.markId);
  out.push({ name: self ? self.name : '', tier: result.tier });
  return out;
}

export default function RollReveal({ seq, skipSeq, result, card, version, reduced, coverHost, reel }) {
  const nodes = useRef({});
  const anims = useRef([]);
  const reg = (name) => (el) => { if (el) nodes.current[name] = el; };

  const stopAll = () => {
    for (const a of anims.current) { try { a.cancel(); } catch { /* gone */ } }
    anims.current = [];
    for (const el of Object.values(nodes.current)) if (el && el.style) el.style.willChange = '';
  };

  // PLAY — in a layout effect, so the first frame of the reveal is the frame the tap paints (<50 ms input)
  useLayoutEffect(() => {
    if (!seq || !result) return undefined;
    stopAll();
    const steps = timeline(version, result.tier, reduced);
    const touched = new Set();
    for (const s of steps) {
      const el = nodes.current[s.node];
      if (!el || typeof el.animate !== 'function') continue;
      if (!touched.has(el)) { el.style.willChange = 'transform, opacity'; touched.add(el); }
      const a = el.animate(s.frames, { delay: s.delay, duration: Math.max(1, s.duration), easing: s.easing || 'linear', fill: 'both' });
      anims.current.push(a);
    }
    if (anims.current.length) {
      Promise.all(anims.current.map((a) => a.finished)).then(stopAll, () => {});
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
  // SKIP — a tap mid-reveal jumps to the result (finish() lands every step on its end state, then rest)
  useLayoutEffect(() => {
    if (!skipSeq) return;
    stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipSeq]);
  useLayoutEffect(() => stopAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tier = result ? result.tier : 'common';
  const cover = (
    <div className={`mr-cover mr-v-${version}`} ref={reg('cover')} aria-hidden="true" style={{ '--mr-tier': tierColour(tier) }}>
      <div className="mr-cover-plate" />
      <div className="mr-cover-bars">
        {BAR_TIERS.map((t, i) => (
          <div key={t} className="mr-bar" ref={reg(`bar${i}`)} style={{ '--mr-bar': tierColour(t) }}>{tierName(t)}</div>
        ))}
      </div>
      <div className="mr-cover-word" ref={reg('tierWord')}>{tierName(tier)}</div>
      <div className="mr-cover-stamp" ref={reg('stamp')}>{result ? `1 IN ${Number(result.oneInX).toLocaleString('en-US')}` : ''}</div>
    </div>
  );
  return (
    <div className={`mr-stage mr-v-${version}${result ? '' : ' is-empty'}${reduced ? ' is-reduced' : ''}`} style={{ '--mr-tier': tierColour(tier) }} data-tier={result ? tier : undefined}>
      <div className="mr-flash" ref={reg('flash')} aria-hidden="true" />
      <div className="mr-reel-win" ref={reg('reelOut')} aria-hidden="true">
        <div className="mr-reel" ref={reg('reel')}>
          {(reel || []).map((r, i) => (
            <div key={i} className="mr-reel-item" style={{ color: tierColour(r.tier) }}>{r.name}</div>
          ))}
        </div>
      </div>
      <div className="mr-back" ref={reg('back')} aria-hidden="true">
        <MarkBadge mark={null} locked size={72} />
      </div>
      <div className="mr-card-slot" ref={reg('card')}>{card}</div>
      {coverHost ? createPortal(cover, coverHost) : null}
    </div>
  );
}
