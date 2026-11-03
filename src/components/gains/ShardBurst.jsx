// gains/ShardBurst.jsx — the REBIRTH ×3 moment's shard burst (NIGHT oct8 #3; painted nov2): SHARD_COUNT pooled PAINTED
// crystal blades (fx/shards — the roll reveal's art) snap out of the slammed plate tip-first, hang, drift and fade in
// one finite one-shot (transform/opacity only; nothing loops; REDUCE MOTION plays nothing). `set` picks the colours —
// violet for a rebirth, gold for a JACKPOT — and is set at render, so the sprites are loaded before the burst.
//
//   <div style={{ position: 'relative' }}><ShardBurst ref={s} set="gold" /></div>
//   s.current.burst(viewportPoint, { w, h, set, n })   // w/h: the box the blades must clear (the plate); set: this burst's
//                                                      // colours; n: how many (≤ SHARD_COUNT — a small claim throws fewer)
//
// The layer's own origin is measured on mount / resize only; a burst() is pure writes.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { kitPlay } from '../kit/motion.js';
import { SHARD_COUNT } from './gainPlan.js';
import { SHARD_MS, bladeFrames, bladeFlavour, clearVectors, fitInside, setSrc } from '../../fx/shards/shardPlan.js';
import './gains.css';

const HALF = 28; // half the sprite box (.gsb-s 56px)

const ShardBurst = forwardRef(function ShardBurst({ className, set = 'violet' }, ref) {
  const layerRef = useRef(null);
  const nodes = useRef([]);
  const origin = useRef(null);
  const flying = useRef(0); // blades still in flight: a burst keeps ITS colours (the screen re-renders the next set mid-burst)
  const wanted = useRef(set);
  // the sprites' src is written here, not rendered: it follows `set` (so the next burst's art is loaded ahead) except
  // while a burst flies — then it is applied when that burst lands
  const paint = (name) => nodes.current.forEach((el, i) => { if (el) { const src = setSrc(name, i); if (el.getAttribute('src') !== src) el.setAttribute('src', src); } });
  useLayoutEffect(() => {
    wanted.current = set;
    if (!flying.current) paint(set);
  }, [set]);
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
      // the blades clear the slammed box, and never fly off the screen (innerWidth/Height: no layout read)
      const n = Math.max(1, Math.min(SHARD_COUNT, (box && box.n) || SHARD_COUNT));
      const vs = fitInside(clearVectors(n, box ? box.w : 120, box ? box.h : 120, { reach: [50, 130] }), from, window.innerWidth, window.innerHeight);
      // the colours of THIS burst (the `set` prop already loaded them; a src write to a cached sprite is instant); the
      // last blade to land hands the pool back to the `set` prop (its own finish event — no timer to drift from the clock)
      if (box && box.set) paint(box.set);
      const landed = () => { flying.current -= 1; if (flying.current <= 0) { flying.current = 0; paint(wanted.current); } };
      vs.forEach((v, i) => {
        const el = nodes.current[i];
        if (!el) return;
        // the blade flight is relative to the burst point: the pool node sits at the layer's origin, so offset it there
        const frames = bladeFrames(v, { s: v.s * 0.85, ...bladeFlavour(i) }).map((f) => ({ ...f, transform: `translate(${x0}px, ${y0}px) ${f.transform}` }));
        const a = kitPlay(el, frames, { duration: SHARD_MS - 80 + (i % 5) * 20, easing: 'linear' });
        if (a) {
          flying.current += 1;
          a.addEventListener('finish', landed, { once: true });
          a.addEventListener('cancel', landed, { once: true });
        }
      });
      if (!flying.current) paint(wanted.current); // REDUCE MOTION: nothing flew
    },
  }));
  return (
    <div ref={layerRef} className={`gsb${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: SHARD_COUNT }, (_, i) => (
        <img key={i} ref={(el) => { nodes.current[i] = el; }} className="gsb-s" alt="" draggable="false" />
      ))}
    </div>
  );
});

export default ShardBurst;
