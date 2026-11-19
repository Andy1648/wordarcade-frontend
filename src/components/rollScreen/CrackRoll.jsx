// CrackRoll.jsx — THE CRACK ROLL (PROTOTYPE, Andy nov18: "down for crack rolls but that can be really hard to make (need a
// really satisfying roll system) so ill def need some crazy previews"). A gear roll opens like a loot drop:
//   the GEAR CORE (painted, one silhouette in five tier colourways) sits there; TAP it —
//   taps 1-3: it SQUASHES, CRACKS spread from the lock (painted ink cracks, revealed outward), light LEAKS out; when the
//     climb says so it JUMPS a tier (white pop, the core changes colour under it, the screen PUNCHES, the tier name SLAMS,
//     its own sound) — sometimes TWO tiers at once (a SKIP: two pops, a bigger punch);
//   tap 4: it CLENCHES, then BURSTS — shell shards fly, the light blasts — and the GEAR CARD slams in (LEGENDARY+ harder).
// HONEST: the result is the roll's own pick (passed in); crackPlan.js only presents it (starts RARE, never falls, never
// shows above the result, ends on it). The ⓘ ODDS chip is the roll's real table (RatesPop). No tap changes the outcome.
// MOTION: finite WAAPI one-shots on transform / opacity, on nodes that always exist (the shard pool is fixed); separate
// wrapper layers (stage punch / core pop / tap squash) so one-shots never cancel each other. Nothing loops: the idle
// "tap me" nudge is ONE wobble per wait. Reduce motion: the taps still step through, nothing moves.
import { useEffect, useRef, useState } from 'react';
import '../kit/tokens.css';
import './CrackRoll.css';
import MarkCard from '../markCard/MarkCard';
import { CARD_RAR, cardTier } from '../markCard/palette.js';
import { markEntry } from '../../progress/markRolls';
import { tierRank } from '../../progress/markRollsCore';
import { MARK_TIERS } from '../../progress/marks';
import { useReduceMotion } from '../../lib/useReduceMotion';
import { SHARD_ART, vesselArt } from './VesselArt';
import RatesPop from './RatesPop.jsx';
import { crackPath, crackJumps, crackRank, CRACK_LADDER, CRACK_TAPS } from './crackPlan.js';
import { sndCrackTap, sndCrackJump, sndCrackCharge } from '../../audio/crackSounds';
import { sndShardBurst, sndRollSting } from '../../audio/rollSounds';

export const CORE_ART = (t) => `/rolls/crack/core-${t}-v1.webp`;
export const CRACK_ART = [1, 2, 3].map((i) => `/rolls/crack/crack-${i}-v1.webp`);
const TAPS = CRACK_TAPS + 1; // three cracks + the open
const NUDGE_MS = 1700; // no tap for this long: ONE wobble says "tap me"
// the light per tier: the painted ray fans (purple / gold), statically hue-turned for blue / pink / cyan (never animated)
const GLOWS = {
  rare: [['epic', 'is-blue']],
  epic: [['epic', '']],
  legendary: [['legendary', '']],
  mythic: [['epic', 'is-pink'], ['epic', 'is-cyan is-off']],
  secret: [['epic', 'is-pink'], ['legendary', 'is-off'], ['epic', 'is-cyan is-off2']],
};
// the leak after each crack: [scale, opacity] of the fan behind the core
const LEAK = [[0.3, 0], [0.55, 0.45], [0.72, 0.65], [0.88, 0.85]];
// the shard pool: fixed nodes, fixed flight paths out of the core (dx, dy in core widths, spin)
const SHARDS = [[-0.95, -0.7, -260], [0.9, -0.8, 300], [-0.35, -1.1, 200], [0.4, -1.05, -220], [-1.05, 0.15, 340], [1.05, 0.05, -320], [-0.6, 0.8, 180], [0.65, 0.75, -160]]
  .map(([dx, dy, r], i) => ({ dx, dy, r, src: SHARD_ART[i % SHARD_ART.length] }));
const EASE_OUT = 'cubic-bezier(.2,.8,.3,1)';
const SPRING = 'cubic-bezier(.2,1.35,.4,1)';
const SHAKE = 'cubic-bezier(.36,.07,.19,.97)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tierName = (t) => (MARK_TIERS[t] ? MARK_TIERS[t].name : String(t).toUpperCase());
const run = (el, frames, opts) => {
  if (!el || typeof el.animate !== 'function') return null;
  el.style.willChange = 'transform, opacity';
  const a = el.animate(frames, opts);
  const off = () => { el.style.willChange = ''; };
  a.finished.then(off, off);
  return a;
};
const heroSize = () => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1366;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
  const v = Math.round(Math.max(180, Math.min(vh * 0.44, vw * 0.74, 420)));
  return { v, card: Math.round(v * 0.62) };
};

/** @param result { markId, tier, shiny? } — the roll's pick (decided before the first tap) · path: an optional fixed climb
 *  (previews) · onDone(result) */
export default function CrackRoll({ result, path: fixedPath = null, rng = Math.random, onDone }) {
  const reduced = useReduceMotion();
  const [path] = useState(() => fixedPath || crackPath(result.tier, rng));
  const [jumps] = useState(() => crackJumps(path));
  const [taps, setTaps] = useState(0);
  const [tier, setTier] = useState('rare');
  const [phase, setPhase] = useState('cracking'); // cracking → burst → open
  const [hero] = useState(heroSize);
  const busy = useRef(false);
  const held = useRef(0);
  const alive = useRef(true);
  const nudgeT = useRef(null);
  const stageRef = useRef(null);
  const flashRef = useRef(null);
  const glowRef = useRef(null);
  const popRef = useRef(null);
  const squashRef = useRef(null);
  const crackRefs = useRef([]);
  const shardRefs = useRef([]);
  const labelRef = useRef(null);
  const cardRef = useRef(null);
  const pipRefs = useRef([]);

  const nudge = () => {
    clearTimeout(nudgeT.current);
    if (reduced) return;
    nudgeT.current = setTimeout(() => {
      if (!alive.current || busy.current) return;
      run(squashRef.current, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg) scale(1.03)', offset: 0.25 }, { transform: 'rotate(6deg)', offset: 0.55 }, { transform: 'rotate(-2deg)', offset: 0.8 }, { transform: 'rotate(0deg)' }], { duration: 520, easing: SHAKE });
    }, NUDGE_MS);
  };
  useEffect(() => {
    alive.current = true;
    if (!reduced) run(popRef.current, [{ transform: 'translateY(-70px) scale(1.4)', opacity: 0 }, { transform: 'translateY(8px) scale(.94)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: SPRING, fill: 'backwards' });
    nudge();
    return () => { alive.current = false; clearTimeout(nudgeT.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const flash = (o = 0.85, ms = 260, delay = 0) => run(flashRef.current, [{ opacity: o }, { opacity: 0 }], { duration: ms, delay, easing: 'ease-out' });
  const punch = (px = 9, ms = 300) => run(stageRef.current, [{ transform: 'none' }, { transform: `translate(${-px}px,${px * 0.6}px)`, offset: 0.15 }, { transform: `translate(${px * 0.8}px,${-px * 0.5}px)`, offset: 0.4 }, { transform: `translate(${-px * 0.35}px,${px * 0.25}px)`, offset: 0.7 }, { transform: 'none' }], { duration: ms, easing: 'ease-out' });
  const slamLabel = (big) => run(labelRef.current, [{ transform: `scale(${big ? 2.6 : 2}) rotate(-6deg)`, opacity: 0 }, { transform: 'scale(.9) rotate(-3deg)', opacity: 1, offset: 0.6 }, { transform: 'rotate(-3deg)', opacity: 1 }], { duration: big ? 380 : 300, easing: SPRING });

  // ONE CRACKING TAP (i = 0..2)
  const crack = async (i) => {
    const before = i === 0 ? 'rare' : path[i - 1];
    sndCrackTap(i, before);
    // the squash: a hard squat, a spring back — harder each tap
    run(squashRef.current, [{ transform: 'scale(1,1)' }, { transform: `scale(${1.1 + 0.03 * i},${0.86 - 0.03 * i}) rotate(${i % 2 ? 4 : -4}deg)`, offset: 0.22 }, { transform: `scale(${0.94},${1.08}) rotate(${i % 2 ? -3 : 3}deg)`, offset: 0.55 }, { transform: 'scale(1,1)' }], { duration: 260 + 30 * i, easing: SPRING });
    // the crack snaps in (the painted cracks, revealed further out each tap)
    run(crackRefs.current[i], [{ transform: 'scale(1.18)', opacity: 0 }, { transform: 'scale(.98)', opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }], { duration: 160, easing: EASE_OUT, fill: 'forwards' });
    // more light leaks out
    const [s0, o0] = LEAK[i]; const [s1, o1] = LEAK[i + 1];
    run(glowRef.current, [{ transform: `scale(${s0})`, opacity: o0 }, { transform: `scale(${s1 * 1.1})`, opacity: Math.min(1, o1 + 0.2), offset: 0.3 }, { transform: `scale(${s1})`, opacity: o1 }], { duration: 380, easing: EASE_OUT, fill: 'forwards' });
    const j = jumps[i];
    if (!j || reduced) { if (j) setTier(path[i]); await wait(reduced ? 0 : 300); return; }
    // THE JUMP: a white pop hides the colour swap, the core pops, the screen punches, the tier name slams
    await wait(140);
    if (!alive.current) return;
    // a SKIP is two pops: through the tier it jumps over, then onto the new one
    const steps = j === 2 ? [CRACK_LADDER[crackRank(path[i]) - 1], path[i]] : [path[i]];
    for (let k = 0; k < steps.length; k += 1) {
      const t = steps[k];
      flash(j === 2 ? 0.95 : 0.85, 240);
      setTier(t);
      sndCrackJump(t, j === 2 && k === steps.length - 1);
      run(popRef.current, [{ transform: 'scale(1.32)' }, { transform: 'scale(.92)', offset: 0.45 }, { transform: 'scale(1.03)', offset: 0.75 }, { transform: 'none' }], { duration: 380, easing: SPRING });
      punch(j === 2 ? 14 : 9, j === 2 ? 380 : 300);
      slamLabel(tierRank(t) >= tierRank('legendary'));
      if (k < steps.length - 1) await wait(170);
    }
    await wait(260);
  };

  // THE OPEN (tap 4): clench, burst, the card slams in
  const burst = async () => {
    const t = result.tier;
    const big = tierRank(t) >= tierRank('legendary');
    const huge = tierRank(t) >= tierRank('mythic');
    if (!reduced) {
      sndCrackCharge(t, 420);
      run(squashRef.current, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.06,.9)', offset: 0.5 }, { transform: 'scale(.9,.9)' }], { duration: 420, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' });
      run(glowRef.current, [{ transform: `scale(${LEAK[3][0]})`, opacity: LEAK[3][1] }, { transform: 'scale(.6)', opacity: 1 }], { duration: 420, easing: 'ease-in', fill: 'forwards' });
      await wait(420);
      if (!alive.current) return;
    }
    setPhase('burst');
    sndShardBurst(t);
    if (reduced) { setPhase('open'); return; }
    flash(big ? 1 : t === 'rare' ? 0.45 : 0.8, big ? 520 : 300);
    run(popRef.current, [{ transform: 'scale(.9)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 240, easing: EASE_OUT, fill: 'forwards' });
    // the light scales WITH the result: a common RARE gets a modest pop, LEGENDARY+ blows the screen open
    const g = { rare: 0.85, epic: 1.1, legendary: 1.4, mythic: 1.6, secret: 1.7 }[t] || 1;
    run(glowRef.current, [{ transform: 'scale(.6)', opacity: 1 }, { transform: `scale(${g * 1.18})`, opacity: 1, offset: 0.4 }, { transform: `scale(${g})`, opacity: t === 'rare' ? 0.6 : 0.9 }], { duration: big ? 700 : 520, easing: EASE_OUT, fill: 'forwards' });
    const k = hero.v * (big ? 1.25 : 1);
    SHARDS.forEach((sh, i) => run(shardRefs.current[i], [
      { transform: 'translate(0,0) rotate(0deg) scale(.6)', opacity: 1 },
      { transform: `translate(${sh.dx * k}px,${sh.dy * k}px) rotate(${sh.r}deg) scale(1.1)`, opacity: 1, offset: 0.7 },
      { transform: `translate(${sh.dx * k * 1.1}px,${sh.dy * k * 1.1 + 50}px) rotate(${sh.r * 1.2}deg) scale(.8)`, opacity: 0 },
    ], { duration: 640 + (i % 3) * 90, delay: i * 16, easing: EASE_OUT, fill: 'backwards' }));
    setPhase('open');
    await wait(30);
    if (!alive.current) return;
    // THE CARD: rises out of the burst; LEGENDARY+ SLAMS (over-scale, a hard land, the screen shakes, the sting)
    run(cardRef.current, big
      ? [{ transform: 'scale(.3) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1.3) rotate(3deg)', opacity: 1, offset: 0.42 }, { transform: 'scale(.93) rotate(-1deg)', offset: 0.7 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'translateY(60px) scale(.5)', opacity: 0 }, { transform: 'translateY(-10px) scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }],
    { duration: big ? 620 : 480, delay: 60, easing: SPRING, fill: 'backwards' });
    setTimeout(() => { if (alive.current) { sndRollSting(t); if (big) { punch(huge ? 18 : 12, huge ? 520 : 380); flash(huge ? 0.9 : 0.6, 380); } } }, big ? 320 : 220);
  };

  const step = async () => {
    if (busy.current) { held.current = Math.min(1, held.current + 1); return; } // a fast tapper is held, never dropped
    if (taps >= TAPS || phase !== 'cracking') return;
    busy.current = true;
    clearTimeout(nudgeT.current);
    const i = taps;
    setTaps(i + 1);
    if (!reduced) run(pipRefs.current[i], [{ transform: 'scale(1.8)' }, { transform: 'none' }], { duration: 240, easing: SPRING });
    if (i < CRACK_TAPS) await crack(i);
    else await burst();
    busy.current = false;
    if (!alive.current) return;
    if (i < CRACK_TAPS) nudge();
  };
  // a held tap fires the moment the last one finishes
  useEffect(() => {
    if (held.current && !busy.current && phase === 'cracking') { held.current -= 1; step(); }
  });

  const m = markEntry(result.markId);
  const line = CARD_RAR[cardTier(tier)].line;
  const crackedTo = Math.min(taps, CRACK_TAPS);
  return (
    <div
      className={`cr is-${tier} is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-label="Crack roll"
      data-testid="crack-roll"
      data-phase={phase}
      data-tier={tier}
      data-taps={taps}
      style={{ '--cr-line': line, '--cr-v': `${hero.v}px` }}
      onClick={(e) => { if (!e.target.closest('button')) step(); }}
    >
      <div className="cr-flash" ref={flashRef} aria-hidden="true" />
      <RatesPop label="ODDS" className="cr-odds" />
      <div className="cr-stage" ref={stageRef}>
        <div className="cr-tier" ref={labelRef} key={tier}>{phase === 'open' ? tierName(result.tier) : tierName(tier)}</div>
        <div className="cr-pod" style={{ width: hero.v, height: hero.v }}>
          <span className="cr-glow" ref={glowRef} aria-hidden="true">
            {GLOWS[phase === 'cracking' ? tier : result.tier].map(([art, cls], i) => <img key={`${tier}${i}`} className={`cr-glow-art${cls ? ` ${cls}` : ''}`} src={vesselArt(art).glow.src} alt="" draggable="false" />)}
          </span>
          <span className="cr-shards" aria-hidden="true">
            {SHARDS.map((sh, i) => <img key={i} className="cr-shard" ref={(el) => { shardRefs.current[i] = el; }} src={sh.src} alt="" draggable="false" />)}
          </span>
          <span className="cr-pop" ref={popRef}>
            <span className="cr-squash" ref={squashRef}>
              {CRACK_LADDER.map((t) => (
                <img key={t} className={`cr-core${t === tier ? ' is-on' : ''}`} src={CORE_ART(t)} alt="" draggable="false" />
              ))}
              {CRACK_ART.map((src, i) => (
                <img key={src} className={`cr-crack${i < crackedTo ? ' is-on' : ''}`} ref={(el) => { crackRefs.current[i] = el; }} src={src} alt="" draggable="false" />
              ))}
            </span>
          </span>
          {phase === 'open' ? (
            <div className="cr-card" ref={cardRef} data-testid="crack-roll-card">
              <MarkCard id={result.markId} tier={result.tier} name={m ? m.name : ''} shiny={!!result.shiny} fx sheen w={hero.card} />
            </div>
          ) : null}
        </div>
        <div className="cr-pips" aria-label={`${taps} of ${TAPS} taps`}>
          {Array.from({ length: TAPS }, (_, i) => <span key={i} className={`cr-pip${i < taps ? ' is-on' : ''}`} ref={(el) => { pipRefs.current[i] = el; }} />)}
        </div>
        {phase === 'open'
          ? <button type="button" className="cr-btn" onClick={() => onDone?.(result)} data-testid="crack-roll-done">NICE</button>
          : <div className="cr-hint">{taps === 0 ? 'TAP TO CRACK' : taps < CRACK_TAPS ? 'TAP!' : 'TAP TO OPEN'}</div>}
      </div>
    </div>
  );
}
