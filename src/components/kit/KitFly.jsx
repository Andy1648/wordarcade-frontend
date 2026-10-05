// KitFly.jsx — 03 FLY TO COUNTER (claude/mockups/v2/KitCurrency.dc.html): "BURST · ARC · LAND".
//
//   <div style={{ position: 'relative' }}>
//     …
//     <KitFlyLayer ref={fly} target={() => pill.current.iconEl()} />
//   </div>
//   fly.current.fly({ from: srcPoint.current, amounts: [12, 12, 13], onLand: (amt) => setGems((g) => g + amt) })
//
// Each gem bursts out of the source (280 ms overshoot), waits, then arcs into the target (600 ms;
// x and y on DIFFERENT easings — that is the arc), and onLand fires as it lands, one by one
// (85 ms apart). The mockup moves left/top; here every gem is a POOLED node (POOL nodes, created
// once) moved by transform only: an outer node carries x, an inner node y, the icon scale + spin.
// Positions are MEASURED ONCE (mount / resize / scroll, rAF-coalesced) and cached; a fly() call is
// pure writes. REDUCE MOTION: no flight — every onLand fires at once.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import KitIcon from './KitIcon.jsx';
import { kitPlay } from './motion.js';
import { reduceMotion } from '../../lib/reduceMotion.js';
import './tokens.css';
import './KitFly.css';

export const FLY_POOL = 12;
export const FLY_BURST_MS = 280;
export const FLY_FLIGHT_MS = 600;
export const FLY_STAGGER_MS = 85;
const BURST_AT = 30;
const FLIGHT_AT = 360;

const centerOf = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** Keep a cached viewport-centre of an element: measured on mount / resize / scroll only. */
export function useCachedCenter(ref) {
  const pt = useRef(null);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      pt.current = centerOf(ref.current);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('resize', queue);
    window.addEventListener('scroll', queue, { passive: true, capture: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', queue);
      window.removeEventListener('scroll', queue, { capture: true });
    };
  }, [ref]);
  return pt;
}

export const KitFlyLayer = forwardRef(function KitFlyLayer({ target, icon = 'gems', size = 34, className }, ref) {
  const layerRef = useRef(null);
  const nodes = useRef([]); // { x, y, s } elements per pool slot
  const next = useRef(0);
  const cache = useRef({ layer: null, target: null });
  const targetFn = useRef(target);
  targetFn.current = target;

  const measure = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const r = layer.getBoundingClientRect();
    cache.current.layer = { x: r.left, y: r.top };
    const t = typeof targetFn.current === 'function' ? targetFn.current() : targetFn.current && targetFn.current.current;
    cache.current.target = centerOf(t);
  }, []);

  useEffect(() => {
    let raf = 0;
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; measure(); });
    };
    measure();
    window.addEventListener('resize', queue);
    window.addEventListener('scroll', queue, { passive: true, capture: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', queue);
      window.removeEventListener('scroll', queue, { capture: true });
    };
  }, [measure]);

  useImperativeHandle(ref, () => ({
    /** Re-measure (call after the target moves for a reason other than resize / scroll). */
    measure,
    /**
     * @param {{from:{x:number,y:number}, amounts:number[], onLand?:(amount:number, i:number)=>void, onDone?:()=>void}} o
     *        `from` is a viewport point (e.g. a cached useCachedCenter, or a pointer event's clientX/Y).
     */
    fly({ from, amounts = [1], onLand, onDone }) {
      const c = cache.current;
      if (!c.layer || !c.target) measure();
      const n = amounts.length;
      if (reduceMotion() || !from || !c.layer || !c.target) {
        amounts.forEach((a, i) => onLand && onLand(a, i));
        if (onDone) onDone();
        return;
      }
      const half = size / 2;
      const ox = from.x - c.layer.x - half;
      const oy = from.y - c.layer.y - half;
      const tx = c.target.x - c.layer.x - half;
      const ty = c.target.y - c.layer.y - half;
      let landed = 0;
      amounts.forEach((amt, i) => {
        const slot = nodes.current[next.current];
        next.current = (next.current + 1) % FLY_POOL;
        if (!slot) return;
        const a = (i / n) * Math.PI * 2 + (Math.random() * 0.8 - 0.4);
        const r = 48 + Math.random() * 38;
        const bx = ox + Math.cos(a) * r;
        const by = oy + Math.sin(a) * r * 0.75;
        const rot0 = Math.random() * 60 - 30;
        const t0 = FLIGHT_AT + i * FLY_STAGGER_MS;
        const T = t0 + FLY_FLIGHT_MS;
        const o1 = BURST_AT / T;
        const o2 = (BURST_AT + FLY_BURST_MS) / T;
        const o3 = t0 / T;
        const burst = 'cubic-bezier(.2,1.6,.4,1)';
        kitPlay(slot.x, [
          { transform: `translateX(${ox}px)`, offset: 0 },
          { transform: `translateX(${ox}px)`, offset: o1, easing: burst },
          { transform: `translateX(${bx}px)`, offset: o2 },
          { transform: `translateX(${bx}px)`, offset: o3, easing: 'cubic-bezier(.6,0,.9,.5)' },
          { transform: `translateX(${tx}px)`, offset: 1 },
        ], { duration: T, easing: 'linear' });
        kitPlay(slot.y, [
          { transform: `translateY(${oy}px)`, offset: 0 },
          { transform: `translateY(${oy}px)`, offset: o1, easing: burst },
          { transform: `translateY(${by}px)`, offset: o2 },
          { transform: `translateY(${by}px)`, offset: o3, easing: 'cubic-bezier(.1,.6,.3,1)' },
          { transform: `translateY(${ty}px)`, offset: 1 },
        ], { duration: T, easing: 'linear' });
        const spin = kitPlay(slot.s, [
          { transform: 'scale(.3) rotate(0deg)', opacity: 1, offset: 0 },
          { transform: 'scale(.3) rotate(0deg)', opacity: 1, offset: o1, easing: 'ease-out' },
          { transform: `scale(1.15) rotate(${rot0}deg)`, opacity: 1, offset: o2 },
          { transform: `scale(1.15) rotate(${rot0}deg)`, opacity: 1, offset: o3, easing: 'linear' },
          { transform: 'scale(.75) rotate(380deg)', opacity: 1, offset: 1 },
        ], { duration: T, easing: 'linear' });
        let done = false;
        const land = () => {
          if (done) return;
          done = true;
          if (onLand) onLand(amt, i);
          landed += 1;
          if (landed === n && onDone) onDone();
        };
        // a gem whose slot is recycled mid-flight still lands (cancel = land now, never lost)
        if (spin) {
          spin.addEventListener('finish', land, { once: true });
          spin.addEventListener('cancel', land, { once: true });
        } else land();
      });
    },
  }));

  return (
    <div ref={layerRef} className={`kfl${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: FLY_POOL }, (_, i) => (
        <div key={i} ref={(el) => { nodes.current[i] = nodes.current[i] || {}; nodes.current[i].x = el; }} className="kfl-x">
          <div ref={(el) => { nodes.current[i] = nodes.current[i] || {}; nodes.current[i].y = el; }} className="kfl-y">
            <div ref={(el) => { nodes.current[i] = nodes.current[i] || {}; nodes.current[i].s = el; }} className="kfl-s" style={{ width: size, height: size }}>
              <KitIcon name={icon} size={size} shadow={2} extras={false} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
