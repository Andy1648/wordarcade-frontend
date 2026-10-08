// gains/GainLayer.jsx — THE ONE GAIN ANIMATION (NIGHT oct8 #3). The kit's KitFlyLayer, upgraded to the spec's beats
// (gainPlan.js): N = 5 / 10 / 20 particles burst out of the source (200 ms ease-out-back), then converge on the target
// in 700–900 ms (ease-in, a shallow arc: x and y ease in on different curves), 60–80 ms apart, shrinking 1 → 0.5.
//
//   <div style={{ position: 'relative' }}>
//     <GainLayer ref={g} icon="gems" target={() => pill.current.iconEl()} />
//   </div>
//   g.current.gain({ from, amount, onFirstLand, onLand, onDone })
//
// onFirstLand fires ONCE, on the first landing (start the target's counter there — countMs(amount)); onLand fires on
// every landing (bump the target — KitPill.bump()); onDone after the last. POOLED: GAIN_POOL nodes made once, moved by
// transform/opacity only (an outer node carries x, an inner y, the icon scale + fade). Positions are MEASURED on
// mount / resize / scroll (rAF-coalesced) and cached — a gain() call is pure writes. REDUCE MOTION: no flight, every
// callback fires at once.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import KitIcon from '../kit/KitIcon.jsx';
import { kitPlay } from '../kit/motion.js';
import { reduceMotion } from '../../lib/reduceMotion.js';
import { GAIN_POOL, BURST_MS, LAND_SCALE, EASE_BURST, EASE_IN_X, EASE_IN_Y, particleCount, planParticles } from './gainPlan.js';
import './gains.css';

const centerOf = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

const GainLayer = forwardRef(function GainLayer({ target, icon = 'gems', size = 34, className }, ref) {
  const layerRef = useRef(null);
  const nodes = useRef([]);
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
    /** Re-measure (the target moved for a reason other than resize / scroll — call it once, never per frame). */
    measure,
    /**
     * @param {{from:{x:number,y:number}, amount:number, count?:number, onFirstLand?:()=>void, onLand?:(i:number)=>void, onDone?:()=>void}} o
     *        `from` is a viewport point (a cached centre, or a pointer event's clientX/Y).
     */
    gain({ from, amount = 1, count, onFirstLand, onLand, onDone }) {
      const c = cache.current;
      if (!c.layer || !c.target) measure();
      const n = Math.min(GAIN_POOL, count || particleCount(amount));
      let first = false;
      const firstLand = () => {
        if (first) return;
        first = true;
        if (onFirstLand) onFirstLand();
      };
      if (reduceMotion() || !from || !c.layer || !c.target) {
        firstLand();
        for (let i = 0; i < n; i += 1) if (onLand) onLand(i);
        if (onDone) onDone();
        return;
      }
      const half = size / 2;
      const ox = from.x - c.layer.x - half;
      const oy = from.y - c.layer.y - half;
      const tx = c.target.x - c.layer.x - half;
      const ty = c.target.y - c.layer.y - half;
      const plan = planParticles(n);
      let landed = 0;
      plan.forEach((p, i) => {
        const slot = nodes.current[next.current];
        next.current = (next.current + 1) % GAIN_POOL;
        if (!slot) return;
        const bx = ox + Math.cos(p.ang) * p.r;
        const by = oy + Math.sin(p.ang) * p.r * 0.75;
        const T = p.land;
        const o1 = BURST_MS / T;
        const o2 = p.wait / T;
        kitPlay(slot.x, [
          { transform: `translateX(${ox}px)`, offset: 0, easing: EASE_BURST },
          { transform: `translateX(${bx}px)`, offset: o1 },
          { transform: `translateX(${bx}px)`, offset: o2, easing: EASE_IN_X },
          { transform: `translateX(${tx}px)`, offset: 1 },
        ], { duration: T, easing: 'linear' });
        kitPlay(slot.y, [
          { transform: `translateY(${oy}px)`, offset: 0, easing: EASE_BURST },
          { transform: `translateY(${by}px)`, offset: o1 },
          { transform: `translateY(${by}px)`, offset: o2, easing: EASE_IN_Y },
          { transform: `translateY(${ty}px)`, offset: 1 },
        ], { duration: T, easing: 'linear' });
        const s = kitPlay(slot.s, [
          { transform: 'scale(.4)', opacity: 0, offset: 0, easing: EASE_BURST },
          { transform: 'scale(1)', opacity: 1, offset: o1 },
          { transform: 'scale(1)', opacity: 1, offset: o2, easing: EASE_IN_X },
          { transform: `scale(${LAND_SCALE})`, opacity: 1, offset: 0.97 },
          { transform: `scale(${LAND_SCALE})`, opacity: 0, offset: 1 },
        ], { duration: T, easing: 'linear' });
        let done = false;
        const land = () => {
          if (done) return;
          done = true;
          firstLand();
          if (onLand) onLand(i);
          landed += 1;
          if (landed === n && onDone) onDone();
        };
        // a particle whose slot is recycled mid-flight still lands (cancel = land now, never lost)
        if (s) {
          s.addEventListener('finish', land, { once: true });
          s.addEventListener('cancel', land, { once: true });
        } else land();
      });
    },
  }));

  return (
    <div ref={layerRef} className={`gl${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: GAIN_POOL }, (_, i) => (
        <div key={i} ref={(el) => { nodes.current[i] = nodes.current[i] || {}; nodes.current[i].x = el; }} className="gl-x">
          <div ref={(el) => { nodes.current[i] = nodes.current[i] || {}; nodes.current[i].y = el; }} className="gl-y">
            <div ref={(el) => { nodes.current[i] = nodes.current[i] || {}; nodes.current[i].s = el; }} className="gl-s" style={{ width: size, height: size }}>
              <KitIcon name={icon} size={size} shadow={2} extras={false} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

export default GainLayer;
