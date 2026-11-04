// FrameFx.jsx — the painted COMPONENTS on a worn avatar frame (frameFx.js says which, and the keyframes). It sits in the
// ring's own box (AvatarFrame passes the ring's placement), so every piece lands on the painted frame at any size.
// MOTION: ONE shared scheduler for every frame on screen (a single setTimeout chain) — each tick lets at most ONE
// on-screen frame breathe, each frame at most every BREATHE_EVERY_MS, so a leaderboard full of frames ripples one at a
// time. Every breath is a finite WAAPI transform/opacity one-shot; will-change only for the run; a hidden tab and
// off-screen frames are skipped; REDUCE MOTION renders nothing. The slot's size is measured ONCE on mount.
import { useEffect, useRef, useState } from 'react';
import { reduceMotion } from '../lib/reduceMotion';
import { setSrc, TIP_DEG } from '../fx/shards/shardPlan.js';
import {
  frameSet, piecesFor, clusterSrc, moteFrames, cornerFrames, orbitFrames,
  TICK_MS, BREATHE_EVERY_MS, MOTE_MS, CORNER_MS, ORBIT_MS,
} from './frameFx.js';
import './FrameFx.css';

// ---- the shared scheduler: one timer for every frame on screen ----
const subs = [];
let cursor = 0;
let timer = null;
function tick() {
  timer = setTimeout(tick, TICK_MS);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const now = Date.now();
  for (let k = 0; k < subs.length; k += 1) {
    const i = (cursor + k) % subs.length;
    if (subs[i](now)) { cursor = i + 1; return; } // ONE frame a tick
  }
}
function subscribe(fn) {
  subs.push(fn);
  if (!timer) timer = setTimeout(tick, 400);
  return () => {
    const i = subs.indexOf(fn);
    if (i >= 0) subs.splice(i, 1);
    if (cursor > subs.length) cursor = 0;
    if (!subs.length && timer) { clearTimeout(timer); timer = null; }
  };
}

const CORNERS = ['tr', 'tl', 'bl', 'br'];

export default function FrameFx({ frame, box }) {
  const root = useRef(null);
  const [px, setPx] = useState(0);
  const off = reduceMotion();
  useEffect(() => { if (root.current && root.current.parentElement) setPx(root.current.parentElement.offsetWidth); }, []); // once
  const p = piecesFor(frame, px || 100);
  const set = frameSet(frame);

  useEffect(() => {
    const el = root.current;
    if (off || !el || !px || typeof el.animate !== 'function') return undefined;
    let seen = true;
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; }) : null;
    if (io) io.observe(el);
    const runs = new Set();
    const play = (node, frames, opts) => {
      node.style.willChange = 'transform, opacity';
      const a = node.animate(frames, { fill: 'none', ...opts });
      runs.add(a);
      const done = () => { node.style.willChange = ''; runs.delete(a); };
      a.finished.then(done, done);
    };
    // the first breath lands a beat after mount (staggered by the scheduler), never all at once
    let last = Date.now() - BREATHE_EVERY_MS + 900;
    const breathe = () => {
      el.querySelectorAll('.avfx-mote').forEach((n, k) => play(n, moteFrames(k), { duration: MOTE_MS, delay: k * 160, easing: 'linear' }));
      el.querySelectorAll('.avfx-corner').forEach((n, k) => play(n, cornerFrames(), { duration: CORNER_MS, delay: k * 90, easing: 'linear' }));
      const ring = el.querySelector('.avfx-orbit');
      if (ring) play(ring, orbitFrames(), { duration: ORBIT_MS, delay: 260, easing: 'linear' });
    };
    // a host (or a preview sheet) can ask for one breath NOW — like GearFx's gfx:flare; it resets this frame's clock
    const onBreathe = () => { last = Date.now(); breathe(); };
    el.addEventListener('avfx:breathe', onBreathe);
    const unsub = subscribe((now) => {
      if (!seen || now - last < BREATHE_EVERY_MS) return false;
      last = now;
      breathe();
      return true;
    });
    return () => {
      el.removeEventListener('avfx:breathe', onBreathe);
      unsub();
      if (io) io.disconnect();
      runs.forEach((a) => { try { a.cancel(); } catch { /* gone */ } });
    };
  }, [off, px, frame]);

  if (off) return null;
  return (
    <span ref={root} className="avfx" style={box} data-avfx={frame} aria-hidden="true">
      {Array.from({ length: p.motes }, (_, k) => (
        <img key={`m${k}`} className={`avfx-mote is-${['l', 'r', 't'][k]}`} src={setSrc(set, k + 1)} alt="" draggable="false" />
      ))}
      {CORNERS.slice(0, p.corners).map((c) => (
        <img key={c} className={`avfx-corner is-${c}`} src={clusterSrc(set)} alt="" draggable="false" />
      ))}
      {p.orbit ? (
        <span className="avfx-orbit">
          {Array.from({ length: p.orbit }, (_, k) => {
            const a = (360 / p.orbit) * k;
            // each arm spans the box, turned to its slot; its blade sits on the top edge pointing RIGHT — along a
            // clockwise lap, tip first (its painted tip angle cancelled)
            return (
              <span key={k} className="avfx-arm" style={{ transform: `rotate(${a}deg)` }}>
                <img className="avfx-blade" src={setSrc(set, k)} style={{ transform: `translate(-50%, -50%) rotate(${-TIP_DEG[k % TIP_DEG.length]}deg)` }} alt="" draggable="false" />
              </span>
            );
          })}
        </span>
      ) : null}
    </span>
  );
}
