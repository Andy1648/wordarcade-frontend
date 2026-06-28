// ModeDialogBackground.jsx
// Per-mode animated canvas that fills the mode dialog behind its content.
// The three render fns (stars / flame / streaks), the helpers (softDot,
// fireRamp, flow, gauss, hexToRgb) and the pointer-lean are ported VERBATIM
// from the approved prototype (mode-dialogs-all3.html). Only the harness is
// React-ified: the prototype's module-level globals live as per-instance
// closures inside one effect, the buffer is sized off clientWidth/clientHeight
// * DPR (never the 300x150 default), and the rAF runs ONLY while mounted.
import { useEffect, useRef } from 'react';

/* ===================== config (locked v5 values) ===================== */
export const MODES = {
  imposter: {
    accent: '#9A1AFF', bg: ['#1d0e44', '#070313'], anim: 'stars',
    chip: 'MULTIPLAYER', t1: 'IMPOSTER', t2: 'WORD',
    liner: "One player's faking it. Find them.",
    sub: 'Social deduction · 4–10 players · everyone gets the word except one.',
    create: 'CREATE',
  },
  bomb: {
    accent: '#FF6B3D', bg: ['#3a1206', '#160503'], anim: 'flame',
    chip: 'MULTIPLAYER', t1: 'WORD', t2: 'BOMB',
    liner: 'Beat the bomb. Combo or choke.',
    sub: 'Turn-based · 2–8 players · type a word with the letters before it blows.',
    create: 'CREATE',
  },
  blitz: {
    accent: '#2EFFE0', bg: ['#053b37', '#03140f'], anim: 'streaks',
    chip: 'SOLO · MULTI', t1: 'CATEGORY', t2: 'BLITZ',
    liner: 'AI judges you. Get creative.',
    sub: 'Speed round · name as many as you can before time runs out.',
    create: 'CREATE',
  },
};

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * One <canvas> filling its parent. `mode` selects the animation; `roar` (CREATE
 * hover) gives the fire a transient surge. DPR-aware, reseeds on resize, and the
 * loop is fully torn down on unmount.
 */
export default function ModeDialogBackground({ mode = 'bomb', roar = false }) {
  const canvasRef = useRef(null);
  const roarTargetRef = useRef(0);

  // roar is updated continuously (hover) — keep it out of the effect deps so the
  // animation never tears down / reseeds mid-hover; the loop reads the ref.
  useEffect(() => {
    roarTargetRef.current = roar ? 1 : 0;
  }, [roar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion = prefersReduced();
    const cur = mode;

    /* ===================== state (was module-level) ===================== */
    let W = 0, H = 0, DPR = 1, lastW = 0, lastH = 0;
    let raf = null, t0 = performance.now();
    let pointerX = 0.5, lean = 0, roarV = 0;

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      // clientWidth/Height = the laid-out size, unaffected by the FLIP transform,
      // so the buffer is correct immediately even mid-morph (the old bug sized off
      // the 300x150 default / the scaled rect).
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(W * DPR));
      canvas.height = Math.max(1, Math.floor(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      lastW = W; lastH = H;
    }
    function resizeIfNeeded() {
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (Math.abs(cw - lastW) > 0.5 || Math.abs(ch - lastH) > 0.5) {
        resize(); seed();
      }
    }

    /* ---------- helpers ---------- */
    function softDot(x, y, r, c, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
      g.addColorStop(0.4, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a * 0.5})`);
      g.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
    function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

    /* ===================== FLAME (bomb) — rich ===================== */
    const FIRE_STOPS = [
      [0.00, [60, 14, 6]], [0.16, [150, 28, 10]], [0.34, [240, 80, 20]],
      [0.56, [255, 150, 40]], [0.76, [255, 224, 150]], [1.00, [255, 255, 240]],
    ];
    function fireRamp(t) {
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      for (let i = 1; i < FIRE_STOPS.length; i++) {
        if (t <= FIRE_STOPS[i][0]) {
          const a = FIRE_STOPS[i - 1], b = FIRE_STOPS[i], f = (t - a[0]) / (b[0] - a[0]);
          return [a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f, a[1][2] + (b[1][2] - a[1][2]) * f];
        }
      }
      return FIRE_STOPS[FIRE_STOPS.length - 1][1];
    }
    function flow(x, y, t) {
      return Math.sin(x * 0.020 + t * 1.9) * 0.6 + Math.cos(y * 0.016 - t * 1.3) * 0.5 + Math.sin((x + y) * 0.012 + t * 2.7) * 0.4;
    }
    let outer = [], inner = [], sparks = [], coals = [];
    let burstTimer = 0;
    function spawnFlameLayer(arr, opts) {
      const baseY = H - 5, cx = W * 0.5;
      for (let i = 0; i < opts.rate; i++) {
        if (arr.length >= opts.max) break;
        const off = gauss() * opts.spread;
        const heat0 = 1 - Math.min(0.4, Math.abs(off) / (opts.spread * 2.2));
        arr.push({
          x: cx + off, y: baseY - Math.random() * 6,
          vx: gauss() * 0.25, vy: -(opts.vy0 + Math.random() * opts.vyr),
          life: 0, max: opts.maxLife * (0.7 + Math.random() * 0.6),
          size: opts.size * (0.7 + Math.random() * 0.7),
          heat0, seed: Math.random() * 1000, hb: opts.heatBoost,
        });
      }
    }
    function spawnSpark(x, y, vyBoost, big) {
      sparks.push({
        x, y, px: x, py: y,
        vx: gauss() * 0.6 + lean * 0.015,
        vy: -(0.8 + Math.random() * 1.9) * (vyBoost || 1),
        life: 0, max: 50 + Math.random() * 60,
        size: (big ? 1.8 : 0.9) + Math.random() * (big ? 2.2 : 1.6),
        tw: Math.random() * 6.28,
      });
    }
    function seedFlame() {
      outer = []; inner = []; sparks = []; coals = [];
      const cx = W * 0.5;
      for (let i = 0; i < 7; i++) {
        coals.push({ x: cx + gauss() * W * 0.16, y: H - 4 - Math.random() * 4, ph: Math.random() * 6.28, r: 8 + Math.random() * 10 });
      }
    }
    function drawFlame(t) {
      const breathe = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.62));
      const flicker = 0.5 + 0.5 * Math.sin(t * 5.1 + Math.sin(t * 2.3) * 1.7);
      const intensity = 0.78 + 0.22 * flicker + 0.55 * roarV;

      ctx.globalCompositeOperation = 'lighter';

      // base heat glow (breathing)
      softDot(W * 0.5 + lean * 0.4, H * 0.93, W * 0.58 * (0.9 + 0.18 * breathe + 0.25 * roarV),
        [255, 120, 45], 0.10 + 0.06 * breathe + 0.08 * roarV);

      // glowing coals at the base
      for (const c of coals) {
        const fl = 0.5 + 0.5 * Math.sin(t * 7 + c.ph);
        softDot(c.x + lean * 0.15, c.y, c.r * (0.8 + 0.5 * fl), [255, 180, 90], 0.22 * fl + 0.08);
      }

      // emit both layers
      spawnFlameLayer(outer, { rate: Math.round(5 + 4 * intensity), max: 360, spread: W * 0.22, vy0: 1.4, vyr: 1.4, maxLife: 70, size: 20, heatBoost: 0.85 });
      spawnFlameLayer(inner, { rate: Math.round(4 + 3 * intensity), max: 220, spread: W * 0.10, vy0: 2.2, vyr: 1.8, maxLife: 80, size: 12, heatBoost: 1.0 });

      // sparks: heavy, steady shower + crackle bursts
      const sCount = 2 + Math.round(Math.random() * 2) + (roarV > 0.4 ? 2 : 0);
      for (let i = 0; i < sCount; i++) spawnSpark(W * 0.5 + gauss() * W * 0.18, H * 0.5 + Math.random() * H * 0.2, 1, Math.random() < 0.18);
      burstTimer -= 16;
      if (burstTimer <= 0) {
        burstTimer = 700 + Math.random() * 700;
        const bx = W * 0.5 + gauss() * W * 0.14, by = H * 0.45 + Math.random() * H * 0.2, n = 10 + Math.random() * 12;
        for (let i = 0; i < n; i++) spawnSpark(bx, by, 1.4, Math.random() < 0.3);
      }

      // draw flame layers
      for (const arr of [outer, inner]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i]; p.life++;
          const lt = p.life / p.max;
          if (lt >= 1) { arr.splice(i, 1); continue; }
          const risen = (H - p.y) / H;
          const f = flow(p.x, p.y, t + p.seed * 0.01);
          p.vx += f * 0.06 * (0.4 + risen) + (lean / Math.max(W, 1)) * 0.10;
          p.vx *= 0.96; p.vy *= 0.992;
          p.x += p.vx; p.y += p.vy;
          const temp = p.heat0 * p.hb * (1 - lt * 0.85) * (0.55 + 0.6 * (1 - risen));
          const col = fireRamp(temp);
          const a = Math.min(1, lt * 6) * (1 - lt) * 0.5 * (0.7 + 0.3 * intensity);
          const sz = p.size * (1.0 - lt * 0.55) * (0.85 + 0.3 * temp);
          softDot(p.x, p.y, Math.max(0.5, sz), col, a);
        }
      }

      // sparks with ember trails
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.life++;
        if (s.life >= s.max) { sparks.splice(i, 1); continue; }
        s.px = s.x; s.py = s.y;
        s.vy += 0.012;
        s.vx += flow(s.x, s.y, t) * 0.025 + (lean / Math.max(W, 1)) * 0.06;
        s.x += s.vx; s.y += s.vy;
        const lt = s.life / s.max;
        const tw = 0.6 + 0.4 * Math.sin(s.life * 0.5 + s.tw);
        const a = (1 - lt) * tw;
        // trail
        ctx.strokeStyle = `rgba(255,200,120,${a * 0.5})`;
        ctx.lineWidth = s.size * 0.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
        // head
        softDot(s.x, s.y, s.size * 2.4, [255, 232, 170], a * 0.95);
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    /* ===================== STARS (imposter) — v5 ===================== */
    let stars = [];
    function seedStars() {
      stars = [];
      for (let i = 0; i < 95; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          s: 0.6 + Math.random() * 2.0, ph: Math.random() * 6.28,
          vx: 0.10 + Math.random() * 0.18, vy: 0.06 + Math.random() * 0.12,
          big: Math.random() < 0.12,
        });
      }
    }
    function drawStars(t) {
      ctx.globalCompositeOperation = 'lighter';
      for (const st of stars) {
        st.x += st.vx; st.y += st.vy;
        if (st.x > W + 4) st.x = -4; if (st.y > H + 4) st.y = -4;
        const tw = 0.45 + 0.55 * Math.sin(t * 1.6 + st.ph);
        const a = tw * (st.big ? 0.9 : 0.55);
        softDot(st.x, st.y, st.s * (st.big ? 3.2 : 2.0), [214, 178, 255], a);
        if (st.big) softDot(st.x, st.y, st.s * 1.1, [255, 255, 255], a);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ===================== STREAKS (blitz) — v5 ===================== */
    let streaks = [];
    function newStreak(anywhere) {
      return {
        x: anywhere ? Math.random() * W : -Math.random() * W * 0.4,
        y: Math.random() * H,
        len: 40 + Math.random() * 150,
        sp: 5 + Math.random() * 11,
        th: 1 + Math.random() * 2.4,
        a: 0.25 + Math.random() * 0.5,
      };
    }
    function seedStreaks() {
      streaks = [];
      for (let i = 0; i < 30; i++) streaks.push(newStreak(true));
    }
    function drawStreaks() {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < streaks.length; i++) {
        const s = streaks[i];
        s.x += s.sp;
        if (s.x - s.len > W) { streaks[i] = newStreak(false); continue; }
        const g = ctx.createLinearGradient(s.x - s.len, s.y, s.x, s.y);
        g.addColorStop(0, 'rgba(46,255,224,0)');
        g.addColorStop(0.8, `rgba(46,255,224,${s.a * 0.6})`);
        g.addColorStop(1, `rgba(180,255,248,${s.a})`);
        ctx.strokeStyle = g; ctx.lineWidth = s.th; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x - s.len, s.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ===================== static (reduced motion) ===================== */
    function drawStatic() {
      const m = MODES[cur] || MODES.bomb; const c = hexToRgb(m.accent);
      const g = ctx.createRadialGradient(W * 0.5, H * 0.9, 0, W * 0.5, H * 0.9, W * 0.8);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.18)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    /* ===================== loop ===================== */
    function seed() {
      if (cur === 'bomb') seedFlame();
      else if (cur === 'imposter') seedStars();
      else seedStreaks();
    }
    function frame(now) {
      const t = (now - t0) / 1000;
      resizeIfNeeded();
      ctx.clearRect(0, 0, W, H);
      lean += ((pointerX - 0.5) * Math.min(W, 260) * 0.6 - lean) * 0.06;
      roarV += (roarTargetRef.current - roarV) * 0.08;
      if (cur === 'bomb') drawFlame(t);
      else if (cur === 'imposter') drawStars(t);
      else drawStreaks();
      raf = requestAnimationFrame(frame);
    }

    // pointer-lean: dialog pointermove -> canvas reads pointerX to bend the fire.
    const leanHost = canvas.closest('.mode-dialog-shell') || canvas.parentElement;
    function onPointerMove(e) {
      if (!leanHost) return;
      const r = leanHost.getBoundingClientRect();
      if (r.width <= 0) return;
      pointerX = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    }
    if (leanHost) leanHost.addEventListener('pointermove', onPointerMove);

    function onResize() {
      resize(); seed();
      if (reduceMotion) drawStatic();
    }
    window.addEventListener('resize', onResize);

    // start
    resize(); seed();
    if (reduceMotion) {
      // reduced motion: paint the static gradient once, never start the rAF.
      drawStatic();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (leanHost) leanHost.removeEventListener('pointermove', onPointerMove);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="mode-dialog-bg-canvas" aria-hidden="true" />;
}
