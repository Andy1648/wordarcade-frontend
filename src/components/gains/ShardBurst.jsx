// gains/ShardBurst.jsx — the REBIRTH ×3 moment's shard burst (NIGHT oct8 #3): SHARD_COUNT pooled vector shards fly out
// of a point and fade in one 600 ms one-shot (transform/opacity only; nothing loops; REDUCE MOTION plays nothing).
//
//   <div style={{ position: 'relative' }}><ShardBurst ref={s} /></div>
//   s.current.burst(viewportPoint)
//
// The layer's own origin is measured on mount / resize only; a burst() is pure writes.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { kitPlay } from '../kit/motion.js';
import { SHARD_COUNT, SHARD_MS, planShards } from './gainPlan.js';
import './gains.css';

// two shard cuts (asymmetric — never a regular triangle) in the house purple / white with an ink outline
const CUTS = ['M2 20 L12 1 L24 15 L10 24 Z', 'M1 8 L20 2 L23 22 L6 17 Z'];
const FILLS = ['#B04BFF', '#FFFFFF', '#D88BFF', '#FFE94A'];

const ShardBurst = forwardRef(function ShardBurst({ className }, ref) {
  const layerRef = useRef(null);
  const nodes = useRef([]);
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
    burst(from) {
      const o = origin.current;
      if (!from || !o) return;
      const x0 = from.x - o.x - 13;
      const y0 = from.y - o.y - 13;
      planShards().forEach((p, i) => {
        const el = nodes.current[i];
        if (!el) return;
        const dx = Math.cos(p.ang) * p.r;
        const dy = Math.sin(p.ang) * p.r;
        kitPlay(el, [
          { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(${p.s})`, opacity: 1 },
          { transform: `translate(${x0 + dx * 0.8}px, ${y0 + dy * 0.8}px) rotate(${p.spin * 0.8}deg) scale(${p.s})`, opacity: 1, offset: 0.55 },
          { transform: `translate(${x0 + dx}px, ${y0 + dy}px) rotate(${p.spin}deg) scale(${p.s * 0.4})`, opacity: 0 },
        ], { duration: SHARD_MS, easing: 'cubic-bezier(.1,.8,.3,1)' });
      });
    },
  }));
  return (
    <div ref={layerRef} className={`gsb${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: SHARD_COUNT }, (_, i) => (
        <div key={i} ref={(el) => { nodes.current[i] = el; }} className="gsb-s">
          <svg viewBox="0 0 26 26" focusable="false">
            <path d={CUTS[i % CUTS.length]} fill={FILLS[i % FILLS.length]} stroke="#0d0618" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );
});

export default ShardBurst;
