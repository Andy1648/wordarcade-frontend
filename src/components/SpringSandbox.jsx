// SpringSandbox.jsx  [night/spring-sandbox — THROWAWAY DEMO, not wired into the game]
//
// A standalone decision aid: 4 identical cards that tilt toward the cursor on
// hover, each driven by a DIFFERENT spring config, so Andy can FEEL them side by
// side and pick the one for the real card-tilt later. Reachable at `/#spring-sandbox`
// (hash route — no server rewrite needed) via the guard in main.jsx. Touches NO
// real components, NO game logic.
//
// Physics: a tiny self-contained rAF critically-/under-damped spring integrator
// (no Framer Motion / no new deps). Each axis (rotateX, rotateY) is a spring with
// {stiffness, damping, mass}; the cursor sets the target, the spring chases it,
// and on mouse-leave the target snaps to 0 so the card springs back with that
// config's own character (overshoot/settle). Transform-only (GPU), one rAF loop
// per card, pointermove is rAF-coalesced (we only store the latest event and read
// it in the frame). prefers-reduced-motion → no tilt at all (flat, calm).

import { useEffect, useRef } from 'react';
import './SpringSandbox.css';

// The 4 configs under test. tension = stiffness, friction = damping. Values are
// shown on each card so Andy can read which is which.
const CONFIGS = [
  {
    key: 'snappy',
    label: 'SNAPPY',
    blurb: 'quick, minimal overshoot',
    accent: '#2EFFE0',
    spring: { stiffness: 420, damping: 32, mass: 1 },
  },
  {
    key: 'bouncy',
    label: 'BOUNCY',
    blurb: 'playful overshoot',
    accent: '#FF2EC4',
    spring: { stiffness: 520, damping: 12, mass: 1 },
  },
  {
    key: 'weighty',
    label: 'WEIGHTY',
    blurb: 'slow momentum',
    accent: '#FFE94A',
    spring: { stiffness: 210, damping: 26, mass: 2.6 },
  },
  {
    key: 'calm',
    label: 'CALM',
    blurb: 'smooth, no bounce',
    accent: '#9A1AFF',
    spring: { stiffness: 170, damping: 30, mass: 1 },
  },
];

const MAX_TILT = 16; // degrees at the card edge — pushed a touch high so the
//                      differences between configs read clearly in the demo.

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// One tilt card. Owns its own spring state + rAF loop for the lifetime of the card.
function SandboxCard({ config }) {
  const { stiffness, damping, mass } = config.spring;
  const elRef = useRef(null);
  const innerRef = useRef(null);
  const rafRef = useRef(0);
  // Spring state per axis: position (deg) + velocity (deg/s). Target is where the
  // cursor wants it; the spring chases the target.
  const stateRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
  const lastTsRef = useRef(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) return; // no animation loop at all under reduced-motion
    const inner = innerRef.current;

    function frame(ts) {
      const st = stateRef.current;
      // dt in seconds, clamped so a tab-switch stall can't explode the integrator.
      const last = lastTsRef.current || ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      if (dt > 0.05) dt = 0.05;

      // Semi-implicit Euler spring for each axis: a = (-k·(x-target) - c·v) / m
      for (const axis of ['x', 'y']) {
        const pos = st[axis];
        const vel = axis === 'x' ? st.vx : st.vy;
        const target = axis === 'x' ? st.tx : st.ty;
        const accel = (-stiffness * (pos - target) - damping * vel) / mass;
        const nextVel = vel + accel * dt;
        const nextPos = pos + nextVel * dt;
        st[axis] = nextPos;
        if (axis === 'x') st.vx = nextVel;
        else st.vy = nextVel;
      }

      if (inner) {
        inner.style.transform = `rotateX(${st.y.toFixed(3)}deg) rotateY(${st.x.toFixed(3)}deg)`;
      }
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced, stiffness, damping, mass]);

  // pointermove only updates the TARGET (cheap); the rAF loop does the easing, so
  // the handler is effectively rAF-coalesced — no per-event layout work.
  function handlePointerMove(e) {
    if (reduced) return;
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
    const st = stateRef.current;
    st.tx = nx * MAX_TILT; // rotateY follows horizontal
    st.ty = -ny * MAX_TILT; // rotateX inverted so the face tips toward the cursor
  }

  function handlePointerLeave() {
    const st = stateRef.current;
    st.tx = 0;
    st.ty = 0; // spring back to flat with this config's character
  }

  return (
    <div className="ss-card-slot">
      <div
        className="ss-card"
        ref={elRef}
        style={{ '--ss-accent': config.accent }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className="ss-card-inner" ref={innerRef}>
          <div className="ss-card-label">{config.label}</div>
          <div className="ss-card-blurb">{config.blurb}</div>
          <div className="ss-card-params">
            <div>tension <b>{stiffness}</b></div>
            <div>friction <b>{damping}</b></div>
            <div>mass <b>{mass}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SpringSandbox() {
  const reduced = prefersReducedMotion();
  return (
    <div className="ss-root">
      <div className="ss-header">
        <h1>SPRING SANDBOX</h1>
        <p>
          Hover each card — they tilt toward your cursor and spring back on leave.
          Four spring configs, side by side. Pick the feel for the real card-tilt.
        </p>
        <p className="ss-note">
          Throwaway demo · not wired into the game · branch <code>night/spring-sandbox</code>
          {reduced && ' · reduced-motion is ON → tilt disabled (flat)'}
        </p>
      </div>
      <div className="ss-grid">
        {CONFIGS.map((c) => (
          <SandboxCard key={c.key} config={c} />
        ))}
      </div>
    </div>
  );
}
