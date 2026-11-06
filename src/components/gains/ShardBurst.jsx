// gains/ShardBurst.jsx — the REBIRTH ×3 moment's shard burst (NIGHT oct8 #3): SHARD_COUNT pooled FLAT vector shards fly
// out of a point and fade in one finite one-shot (transform/opacity only; nothing loops; REDUCE MOTION plays nothing).
// Flat again since nov5 (Andy "extra"): the painted crystal blades of nov2 did not fit the house style. `set` picks the
// colours per burst — violet for a rebirth, gold for a JACKPOT.
//
//   <div style={{ position: 'relative' }}><ShardBurst ref={s} /></div>
//   s.current.burst(viewportPoint, { w, h, set })   // w/h: the box the shards must clear (the plate); set: 'violet' | 'gold'
//
// The layer's own origin is measured on mount / resize only; a burst() is pure writes.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { kitPlay } from '../kit/motion.js';
import { SHARD_COUNT } from './gainPlan.js';
import { SHARD_MS, clearVectors, fitInside } from '../../fx/shards/shardPlan.js';
import './gains.css';

const HALF = 13; // half the shard box (.gsb-s 26px)
// two shard cuts (asymmetric — never a regular triangle) in the house colours with an ink outline
const CUTS = ['M2 20 L12 1 L24 15 L10 24 Z', 'M1 8 L20 2 L23 22 L6 17 Z'];
const FILLS = {
  violet: ['#B04BFF', '#FFFFFF', '#D88BFF', '#FFE94A'],
  gold: ['#FFE94A', '#FFFFFF', '#FFC23D', '#FF6B3D'],
};

const ShardBurst = forwardRef(function ShardBurst({ className }, ref) {
  const layerRef = useRef(null);
  const nodes = useRef([]);
  const paths = useRef([]);
  const origin = useRef(null);
  useEffect(() => {
    const measure = () => {
      const el = layerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      origin.current = { x: r.left, y: r.top };
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  useImperativeHandle(ref, () => ({
    burst(from, box) {
      const o = origin.current;
      if (!from || !o) return;
      const x0 = from.x - o.x - HALF;
      const y0 = from.y - o.y - HALF;
      const fills = FILLS[box && box.set] || FILLS.violet;
      // the shards clear the slammed box, and never fly off the screen (innerWidth/Height: no layout read)
      const vs = fitInside(clearVectors(SHARD_COUNT, box ? box.w : 120, box ? box.h : 120, { reach: [50, 130] }), from, window.innerWidth, window.innerHeight);
      vs.forEach((v, i) => {
        const el = nodes.current[i];
        if (!el) return;
        if (paths.current[i]) paths.current[i].setAttribute('fill', fills[i % fills.length]);
        const spin = (i % 2 ? 1 : -1) * (120 + ((i * 53) % 150));
        const s = v.s * 1.3;
        kitPlay(el, [
          { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(${s})`, opacity: 1 },
          { transform: `translate(${x0 + v.x * 0.8}px, ${y0 + v.y * 0.8}px) rotate(${spin * 0.8}deg) scale(${s})`, opacity: 1, offset: 0.55 },
          { transform: `translate(${x0 + v.x}px, ${y0 + v.y}px) rotate(${spin}deg) scale(${s * 0.4})`, opacity: 0 },
        ], { duration: SHARD_MS, easing: 'cubic-bezier(.1,.8,.3,1)' });
      });
    },
  }));
  return (
    <div ref={layerRef} className={`gsb${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: SHARD_COUNT }, (_, i) => (
        <div key={i} ref={(el) => { nodes.current[i] = el; }} className="gsb-s">
          <svg viewBox="0 0 26 26" focusable="false">
            <path ref={(el) => { paths.current[i] = el; }} d={CUTS[i % CUTS.length]} fill={FILLS.violet[i % FILLS.violet.length]} stroke="#0d0618" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );
});

export default ShardBurst;
