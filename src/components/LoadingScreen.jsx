// LoadingScreen.jsx
// The boot screen: the bomb mascot IS the loading indicator. A long fuse runs
// left-to-right; a flame travels along it while the app gets READY (fonts +
// the App module — see lib/bootReady.js), leaving a burned (dark, thinner)
// trail behind. When ready (≥ 700 ms, ≤ 5000 ms) the flame reaches the mascot
// and it "explodes" (white flash + blast rings), then it hands off (onComplete)
// to the splash. On a dropped/failed connection the fuse goes out: the mascot
// panics and a RELIGHT button reloads the page.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './LoadingScreen.css';
import Mascot from './Mascot';
import { bootReady, fuseProgress, FLOOR_MS, HARD_CAP_MS, HANDOFF_MS } from '../lib/bootReady.js';

// Gentle wavy fuse (viewBox 0 0 1000 100, stretched to fill). Starts left,
// ends at ~x900 where the mascot bomb sits.
const FUSE_PATH = 'M 26 54 C 170 28 300 80 460 52 C 600 30 740 78 900 54';

const MESSAGES = [
  'Lighting the fuse...',
  'Loading the dictionary...',
  'Warming up the bombs...',
  'The bomb looks nervous...',
  'Almost there...',
  'Connecting to the arena...',
];

// A few spark particles that trail up off the flame (horizontal drift + delay).
const SPARKS = [
  { dx: -7, delay: 0 },
  { dx: 5, delay: 160 },
  { dx: -2, delay: 320 },
];

export default function LoadingScreen({ status, onComplete, onRetry }) {
  const failed = status === 'error' || status === 'closed';

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'exploding'
  const [textIndex, setTextIndex] = useState(0);
  const [pathLen, setPathLen] = useState(0);
  const [flame, setFlame] = useState({ x: 26, y: 54 });
  const fusePathRef = useRef(null);

  // Measure the fuse path once it's in the DOM, so we can place the flame along
  // it and drive the burned-trail dash.
  useLayoutEffect(() => {
    if (fusePathRef.current) {
      try {
        setPathLen(fusePathRef.current.getTotalLength());
      } catch {
        /* getTotalLength unsupported - flame just stays at the start */
      }
    }
  }, []);

  // Flame position: the point at the current progress fraction along the path.
  useEffect(() => {
    const path = fusePathRef.current;
    if (!path || !pathLen) return;
    try {
      const pt = path.getPointAtLength((Math.min(progress, 100) / 100) * pathLen);
      setFlame({ x: pt.x, y: pt.y });
    } catch {
      /* no-op */
    }
  }, [progress, pathLen]);

  // READINESS-DRIVEN INTRO (perf/first-load): the boot screen finishes when the app is
  // actually ready — document.fonts.ready AND the App module resolved + mounted
  // (lib/bootReady.js) — no earlier than FLOOR_MS (700) and no later than HARD_CAP_MS
  // (5000). It replaced a fixed 1900 ms burn that sat on the LCP path for every visitor.
  // `doneRef` lets the cosmetic rAF loop below stop the instant the hand-off fires.
  const doneRef = useRef(false);

  // COSMETIC flame timeline (requestAnimationFrame), driven by the same clock the
  // hand-off uses: fuseProgress(elapsed) burns briskly to 70% across the floor, then
  // creeps toward 95% up to the cap; finish() snaps it to 100. This ONLY advances the
  // visual flame. It must NEVER be what decides when we hand off: rAF is suspended in
  // a backgrounded/hidden tab, which is exactly how the boot screen could hang forever.
  useEffect(() => {
    let raf = 0;
    let start = null;
    const tick = (now) => {
      if (doneRef.current) return;
      if (start === null) start = now;
      setProgress(fuseProgress(now - start));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Hand-off is PROMISE/TIMER-driven (both keep firing in a hidden tab, unlike rAF),
  // so the boot screen can NEVER hang: finish when bootReady() resolves AND the floor
  // has elapsed, immediately if a backgrounded tab becomes visible, and unconditionally
  // at the hard cap — whichever comes first. onComplete is read through a ref so App
  // re-renders (ws messages, timer ticks) can't reset the timers by changing identity.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    let cancelled = false;
    let handoff;
    const finish = () => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      setProgress(100); // snap the flame to the bomb even if rAF was suspended
      setPhase('exploding');
      // A beat of explosion, then hand off (the same 600 ms handoff as before).
      handoff = setTimeout(() => onCompleteRef.current && onCompleteRef.current(), HANDOFF_MS);
    };
    const floor = new Promise((r) => setTimeout(r, FLOOR_MS));
    Promise.all([bootReady(), floor]).then(finish, finish);
    const hardTimer = setTimeout(finish, HARD_CAP_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') finish();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(hardTimer);
      clearTimeout(handoff);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Run once on mount; onComplete is read via ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycling flavor text.
  useEffect(() => {
    if (failed) return undefined;
    const id = setInterval(() => setTextIndex((i) => (i + 1) % MESSAGES.length), 1500);
    return () => clearInterval(id);
  }, [failed]);

  const exploding = phase === 'exploding';
  const pose = failed ? 'panic' : exploding ? 'celebrate' : progress >= 50 ? 'panic' : 'idle';
  // Mascot grows from 1.0 to 1.1 as tension builds.
  const mascotScale = 1 + (Math.min(progress, 90) / 90) * 0.1;
  const shaking = !failed && !exploding && progress > 80;

  // Burned (consumed) length along the path, in path units.
  const burned = pathLen ? (Math.min(progress, 100) / 100) * pathLen : 0;
  // Dashes: brown rope shows only the UNBURNED right part; the dark burned line
  // shows only the consumed left part. (See CSS for stroke colours/widths.)
  const unburnedDash = `0 ${burned} ${pathLen}`;
  const burnedDash = `${burned} ${pathLen}`;

  return (
    <div className="loading-wrap">
      <div className="loading-title">TYPE A WORD</div>

      <div className={`loading-scene${failed ? ' failed' : ''}`}>
        <svg className="loading-fuse-svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
          {/* darker bottom edge for dimension */}
          <path d={FUSE_PATH} className="loading-fuse-shade" transform="translate(0 2.6)" style={{ strokeDasharray: unburnedDash }} />
          {/* brown rope (unburned part) */}
          <path d={FUSE_PATH} ref={fusePathRef} className="loading-fuse-rope" style={{ strokeDasharray: unburnedDash }} />
          {/* burned trail: dark + thinner, only on the consumed (left) part */}
          {pathLen > 0 && (
            <path d={FUSE_PATH} className="loading-fuse-burned" style={{ strokeDasharray: burnedDash }} />
          )}
        </svg>

        {/* Flame + percentage + sparks, riding the burning tip. */}
        {!failed && pathLen > 0 && (
          <div className="loading-flame-pos" style={{ left: `${flame.x / 10}%`, top: `${flame.y}%` }}>
            {/* Indeterminate "working" cue riding the flame. We can't measure the
                real socket/asset readiness (the connection warms in the
                background), so we show pulsing dots instead of a fake percentage
                that would appear frozen while a cold backend spins up. */}
            <div className="loading-dots" role="status" aria-label="Loading">
              <span></span><span></span><span></span>
            </div>
            <svg className="loading-flame" viewBox="-12 -34 24 40" aria-hidden="true">
              <ellipse cx="0" cy="-13" rx="9" ry="17" fill="#FF6B3D" stroke="#B23C00" strokeWidth="2.5" />
              <ellipse cx="0" cy="-15" rx="5.5" ry="12" fill="#FFE94A" />
              <ellipse cx="0" cy="-16" rx="2.5" ry="7" fill="#FFF6C8" />
            </svg>
            {SPARKS.map((s, i) => (
              <span key={i} className="loading-spark" style={{ '--sdx': `${s.dx}px`, animationDelay: `${s.delay}ms` }} />
            ))}
          </div>
        )}

        {/* Failed: a dead red flame stub frozen where the fuse went out. */}
        {failed && pathLen > 0 && (
          <div className="loading-flame-pos" style={{ left: `${flame.x / 10}%`, top: `${flame.y}%` }}>
            <svg className="loading-flame" viewBox="-12 -34 24 40" aria-hidden="true">
              <ellipse cx="0" cy="-11" rx="7" ry="10" fill="#FF5C5C" stroke="#7a1010" strokeWidth="2.5" />
            </svg>
          </div>
        )}

        {/* The mascot bomb at the right end of its own fuse — the shared Mascot component
            (WebP via <picture>, PNG fallback). Its idle breathe loop is off here (CSS) so the
            boot screen adds no infinite animation; the pose swap replays the enter pop. */}
        <div className="loading-mascot-wrap" style={{ transform: `translateY(-50%) scale(${mascotScale.toFixed(3)})` }}>
          <Mascot pose={pose} className={`loading-mascot${shaking ? ' shaking' : ''}`} />
        </div>

        {/* The explosion when the flame reaches the bomb (and it survives). */}
        {exploding && (
          <div className="loading-explosion" aria-hidden="true">
            <div className="loading-explosion-flash" />
            <div className="loading-explosion-ring" />
            <div className="loading-explosion-ring inner" />
          </div>
        )}
      </div>

      {failed ? (
        <div className="loading-error">
          <div className="loading-error-text">THE FUSE WENT OUT</div>
          <button className="loading-relight" onClick={onRetry}>RELIGHT</button>
        </div>
      ) : (
        <div className="loading-msg-row">
          <span key={textIndex} className="loading-msg">{MESSAGES[textIndex]}</span>
        </div>
      )}
    </div>
  );
}
