// CursorTrail.jsx
// A spray-paint trail that follows the cursor (or finger) across every screen.
// For performance this bypasses React entirely: it appends/removes plain DOM
// nodes directly (state updates 30+ times/sec would be far too expensive). The
// React part is just a host <div>; everything else is imperative in an effect.
import { useEffect, useRef } from 'react';
import './CursorTrail.css';

const PALETTE = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];
const MAX_DOTS = 30;
const THROTTLE_MS = 30; // spawn at most one trail dot per 30ms of movement

export default function CursorTrail() {
  const layerRef = useRef(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;

    const dots = []; // live dot entries { el, timer, removed }
    let lastSpawn = 0;

    const rand = (min, max) => min + Math.random() * (max - min);

    function removeEntry(entry) {
      if (entry.removed) return;
      entry.removed = true;
      clearTimeout(entry.timer);
      entry.el.remove();
      const i = dots.indexOf(entry);
      if (i >= 0) dots.splice(i, 1);
    }

    function spawn(x, y, opts = {}) {
      const size = opts.size ?? rand(4, 8);
      const el = document.createElement('div');
      el.className = opts.burst ? 'cursor-dot burst' : 'cursor-dot';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.background = PALETTE[(Math.random() * PALETTE.length) | 0];
      // Slightly irregular radii so they read as paint drops, not pixels.
      el.style.borderRadius = `${rand(40, 60)}% ${rand(40, 60)}% ${rand(40, 60)}% ${rand(40, 60)}%`;
      if (opts.burst) {
        el.style.setProperty('--dx', `${opts.dx}px`);
        el.style.setProperty('--dy', `${opts.dy}px`);
      }
      layer.appendChild(el);

      const entry = { el, removed: false };
      el.addEventListener('animationend', () => removeEntry(entry), { once: true });
      entry.timer = setTimeout(() => removeEntry(entry), 1000); // safety fallback
      dots.push(entry);

      // Cap the live count - drop the oldest beyond the limit.
      while (dots.length > MAX_DOTS) removeEntry(dots[0]);
    }

    function trail(x, y) {
      const now = Date.now();
      if (now - lastSpawn < THROTTLE_MS) return;
      lastSpawn = now;
      spawn(x, y);
    }

    function splatter(x, y) {
      const n = 8 + ((Math.random() * 5) | 0); // 8-12 dots
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.3, 0.3);
        const dist = rand(10, 20);
        spawn(x, y, { burst: true, dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, size: rand(5, 9) });
      }
    }

    const onMouseMove = (e) => trail(e.clientX, e.clientY);
    const onClick = (e) => splatter(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      const t = e.touches[0];
      if (t) trail(t.clientX, t.clientY);
    };
    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (t) splatter(t.clientX, t.clientY);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchstart', onTouchStart);
      dots.slice().forEach(removeEntry);
    };
  }, []);

  return <div className="cursor-trail" ref={layerRef} aria-hidden="true" />;
}
