// FuseHudV2.jsx — the SEASON 2 FUSE HUD (claude/mockups/v2/Fuse.dc.html, VERSION A "WICK"; SEASON2-QUEUE P10 10b):
// lives column on the left edge, the fragment plate, the fuse line running ACROSS the screen with its spark, the
// ×5 FRENZY badge on the right edge, the 26-letter strip on the floor. CLUTCH (≤2 s on the fuse) = hazard bands
// on the two side edges. Nothing pops in the centre: the FRENZY start slams the BADGE, a CLUTCH word flashes the bands.
//
// Presentation only. Every number comes from the live rules (fuse.js engine state, frenzy.js, the solo clock);
// the mockup's numbers are placeholders. Motion: finite WAAPI one-shots through kitPlay (transform/opacity only,
// REDUCE MOTION skips them); the per-frame fuse line is a transform write, never a layout read.
import { useEffect, useRef, useState } from 'react';
import { kitPlay } from '../components/kit/motion.js';
import { formatNum } from '../format.js';
import './SoloV2.css';
import './FuseHudV2.css';

const ABC = 'abcdefghijklmnopqrstuvwxyz'.split('');
const HEART = 'M16 29 C6 21 2 16 2 10 C2 5 6 2 10 2 C13 2 15 4 16 6 C17 4 19 2 22 2 C26 2 30 5 30 10 C30 16 26 21 16 29 Z';

const NRING = 48;
function arcPath(c, r, a0, a1) {
  const k = Math.PI / 180;
  const x0 = c + r * Math.cos(a0 * k);
  const y0 = c + r * Math.sin(a0 * k);
  const x1 = c + r * Math.cos(a1 * k);
  const y1 = c + r * Math.sin(a1 * k);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
const RING = Array.from({ length: NRING }, (_, j) => {
  const b = -90 + (j * 360) / NRING + 1;
  return arcPath(90, 74, b, b + 360 / NRING - 2);
});

/** PURE: how many of the badge ring's 48 segments are lit — frenzy time left, else letters lit of 26. */
export function ringLit({ frenzyMs = 0, frenzyTotalMs = 300000, lit = 0 }) {
  if (frenzyMs > 0) return Math.max(1, Math.ceil((Math.min(frenzyMs, frenzyTotalMs) / frenzyTotalMs) * NRING - 0.001));
  return Math.round((Math.max(0, Math.min(26, lit)) / 26) * NRING);
}

/** PURE: "m:ss" for a frenzy countdown. */
export function mmss(ms) {
  const t = Math.max(0, Math.ceil((ms || 0) / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const POP = [
  { transform: 'scale(.3) rotate(-10deg)', opacity: 0 },
  { transform: 'scale(1.12) rotate(2deg)', opacity: 1, offset: 0.6 },
  { transform: 'scale(1) rotate(0deg)', opacity: 1 },
];
const SLAM = [
  { transform: 'scale(2.2) rotate(-14deg)', opacity: 0 },
  { transform: 'scale(.9) rotate(-3deg)', opacity: 1, offset: 0.55 },
  { transform: 'scale(1.06)', offset: 0.75 },
  { transform: 'scale(1) rotate(0deg)', opacity: 1 },
];
const LIT = [{ transform: 'translateY(-4px) scale(1.6) rotate(-8deg)' }, { transform: 'translateY(-4px) scale(.9)', offset: 0.6 }, { transform: 'translateY(-4px) scale(1)' }];
const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.3)', offset: 0.4 }, { transform: 'scale(1)' }];
const IN_L = [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }];
const IN_R = [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }];
const FLASH = [{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }];

function Lives({ lives, max, words, best }) {
  const ref = useRef([]);
  const prev = useRef(lives);
  useEffect(() => {
    const was = prev.current;
    prev.current = lives;
    if (lives > was) kitPlay(ref.current[lives - 1], BUMP, { duration: 350, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }, [lives]);
  const hearts = [];
  for (let k = 0; k < max; k++) {
    const full = k < lives;
    hearts.push(
      <svg key={k} ref={(el) => { ref.current[k] = el; }} className={`fz2-heart${full ? ' is-full' : ''}`} viewBox="-2 -2 36 36" aria-hidden="true">
        <path d={HEART} strokeWidth="4" strokeLinejoin="round" />
        {full ? <path d="M8 8 C6 9 5.5 11 6 13" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" /> : null}
      </svg>
    );
  }
  return (
    <div className="fz2-lives" aria-label={`${lives} lives`}>
      <div className="fz2-hearts">{hearts}</div>
      <div className="fz2-words">
        <b translate="no">{formatNum(words)}</b>
        <span>WORDS</span>
        <span className="fz2-best">BEST {formatNum(best)}</span>
      </div>
    </div>
  );
}

function Plate({ frag }) {
  const ref = useRef(null);
  useEffect(() => {
    kitPlay(ref.current, POP, { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }, [frag]);
  const f = String(frag || '').toUpperCase();
  return (
    <div className="fz2-plate" data-frag={f}>
      <div ref={ref} className="fz2-plate-in">
        <svg viewBox="0 0 560 220" preserveAspectRatio="none" aria-hidden="true">
          <path d="M52 18 L548 6 L520 214 L14 206 Z" fill="#000" transform="translate(10 10)" />
          <path className="fz2-plate-fill" d="M52 18 L548 6 L520 214 L14 206 Z" stroke="#000" strokeWidth="7" strokeLinejoin="round" />
          <path d="M60 30 L300 24" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".18" />
          <path className="fz2-plate-edge" d="M548 6 L520 214 L496 214 L522 7 Z" />
          <path className="fz2-plate-edge" d="M14 206 L40 160 L64 206 Z" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
        </svg>
        <div className={`fz2-frag${f.length > 2 ? ' is-3' : ''}`} translate="no">{f}</div>
      </div>
    </div>
  );
}

function Wick({ frac, secs, clutch, warm, dock }) {
  const f = Math.max(0, Math.min(1, frac));
  return (
    <div className={`fz2-wick${clutch ? ' is-clutch' : warm ? ' is-warm' : ''}`} aria-hidden="true">
      {dock ? <span className="fz2-dock">{dock}</span> : null}
      <div className="fz2-wick-track">
        <div className="fz2-wick-fill" style={{ transform: `scaleX(${f})` }} />
        <div className="fz2-wick-run" style={{ transform: `translateX(${(f * 100).toFixed(2)}%)` }}>
          <svg className="fz2-spark" viewBox="-30 -30 60 60">
            <path d="M0 -26 L7 -8 L26 -8 L11 4 L17 24 L0 12 L-17 24 L-11 4 L-26 -8 L-7 -8 Z" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            <circle r="6" fill="#fff" />
          </svg>
          <span className={`fz2-secs${f > 0.5 ? ' is-left' : ''}`} translate="no">{secs}</span>
        </div>
      </div>
    </div>
  );
}

function Badge({ frenzyMs, frenzyTotalMs, lit, mult, minutes, slamKey }) {
  const ref = useRef(null);
  useEffect(() => {
    if (slamKey) kitPlay(ref.current, SLAM, { duration: 600, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }, [slamKey]);
  const on = frenzyMs > 0;
  const n = ringLit({ frenzyMs, frenzyTotalMs, lit });
  const dark = 26 - lit;
  return (
    <div className={`fz2-badge${on ? ' is-frenzy' : ''}`} aria-label={on ? `Frenzy ${mmss(frenzyMs)} left` : `${dark} letters to go`}>
      <div ref={ref} className="fz2-badge-in">
        <span className="fz2-badge-top">{on ? 'FRENZY' : 'LIGHT ALL 26'}</span>
        <div className="fz2-ring">
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <circle cx="90" cy="90" r="74" fill="none" stroke="#000" strokeWidth="26" />
            {RING.map((d, i) => (
              <path key={i} d={d} fill="none" strokeWidth="16" className={i < n ? 'is-on' : 'is-off'} />
            ))}
            <circle cx="90" cy="90" r="58" fill="#000" />
          </svg>
          <span className="fz2-x5" translate="no">×{formatNum(mult)}</span>
        </div>
        <span className="fz2-badge-big" translate="no">{on ? mmss(frenzyMs) : `${formatNum(dark)} LEFT`}</span>
        <span className="fz2-badge-sub">{on ? `EVERY WORD ×${formatNum(mult)}` : `→ ${formatNum(minutes)} MIN OF ×${formatNum(mult)} WINS`}</span>
      </div>
    </div>
  );
}

function Strip({ used, frag, frenzy }) {
  const tiles = useRef({});
  const prev = useRef(null);
  const lbl = useRef(null);
  const sig = ABC.filter((ch) => used.has(ch)).join(''); // re-run on a real change only, not every clock frame
  useEffect(() => {
    const was = prev.current;
    prev.current = sig;
    if (was == null) return;
    for (const ch of sig) if (!was.includes(ch)) kitPlay(tiles.current[ch], LIT, { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    if (sig.length < was.length) kitPlay(lbl.current, BUMP, { duration: 350 }); // the strip cleared
  }, [sig]);
  const f = String(frag || '').toLowerCase();
  return (
    <div className={`fz2-strip${frenzy ? ' is-frenzy' : ''}`} aria-label={`${used.size} of 26 letters lit`}>
      <span ref={lbl} className="fz2-strip-n"><b translate="no">{formatNum(used.size)} / 26</b> LETTERS</span>
      <div className="fz2-tiles" aria-hidden="true">
        {ABC.map((ch) => {
          const on = used.has(ch);
          return (
            <span
              key={ch}
              ref={(el) => { tiles.current[ch] = el; }}
              className={`fz2-tile${on ? ' is-lit' : f.includes(ch) ? ' is-frag' : ''}`}
            >
              {ch.toUpperCase()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The two side-edge hazard bands. Mounted while the fuse is in the CLUTCH zone; `flashKey` flashes them on a CLUTCH word. */
function Hazard({ flashKey }) {
  const l = useRef(null);
  const r = useRef(null);
  useEffect(() => {
    kitPlay(l.current, IN_L, { duration: 220, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    kitPlay(r.current, IN_R, { duration: 220, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }, []);
  useEffect(() => {
    if (!flashKey) return;
    kitPlay(l.current, FLASH, { duration: 600 });
    kitPlay(r.current, FLASH, { duration: 600 });
  }, [flashKey]);
  const band = (ref, side) => (
    <svg ref={ref} className={`fz2-haz fz2-haz--${side}`} preserveAspectRatio="xMidYMin slice" viewBox="0 0 28 2400" aria-hidden="true">
      <defs>
        <pattern id={`fz2hz-${side}`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="28" fill="#FF3D7F" />
          <rect x="14" width="14" height="28" fill="#000" />
        </pattern>
      </defs>
      <rect width="28" height="2400" fill={`url(#fz2hz-${side})`} />
    </svg>
  );
  return (
    <>
      {band(l, 'l')}
      {band(r, 'r')}
    </>
  );
}

/** A bonus a moment just paid, said on the LEFT EDGE above the fuse line (never the centre): "CLUTCH! 1.4S LEFT +N". */
function EdgeGain({ gain }) {
  const ref = useRef(null);
  useEffect(() => {
    kitPlay(ref.current, IN_L, { duration: 240, easing: 'cubic-bezier(.2,1.2,.4,1)' });
  }, []);
  const clutch = gain.kind === 'clutch';
  const label = clutch
    ? `CLUTCH! ${((gain.leftMs || 0) / 1000).toFixed(1)}S LEFT`
    : gain.started ? 'FRENZY!' : 'FULL STRIP';
  return (
    <div ref={ref} className={`fz2-gain fz2-gain--${gain.kind}`} role="status">
      <span className="fz2-gain-k">{label}</span>
      {gain.bonus > 0 ? <b translate="no">+{formatNum(gain.bonus)} WINS</b> : null}
    </div>
  );
}

/** A rare word's band ("RARE", "MYTHIC"...), said on the RIGHT edge over the fuse line for a beat — the S2 home of
 *  the centred RarityFlash. Band only, no ×N (rarity never multiplies a solo payout). */
function EdgeRare({ band, color }) {
  const ref = useRef(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    kitPlay(ref.current, IN_R, { duration: 240, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    const t = setTimeout(() => setOn(false), 1600);
    return () => clearTimeout(t);
  }, []);
  if (!on) return null;
  return (
    <div ref={ref} className="fz2-rare" style={{ color }} aria-hidden="true">
      {band}
    </div>
  );
}

/**
 * The whole play phase. `parts` are SoloShell's pieces ({ exit, form, teach, reason, winsPill, stack }).
 * clock = { remaining, tMax, armed, redZone }; clutchMs = the CLUTCH window (frenzy.js CLUTCH_MS).
 */
export default function FuseHudV2({
  parts, frag, lives, maxLives = 3, words, best, used, clock, clutchMs, dock,
  frenzyMs, frenzyTotalMs, mult, minutes, slamKey, clutchFlash, gain, rare,
}) {
  const remaining = Math.max(0, clock.remaining || 0);
  const frac = clock.armed ? remaining / Math.max(1, clock.tMax || 1) : 1;
  const clutch = !!clock.armed && remaining <= clutchMs;
  const warm = !!clock.armed && remaining <= 4000;
  const secs = remaining / 1000;
  const frenzy = frenzyMs > 0;
  const lit = used.size;
  return (
    <div className={`fz2${clutch ? ' is-clutch' : ''}${frenzy ? ' is-frenzy' : ''}`}>
      <div className="fz2-top">
        {parts.exit}
        <span className="fz2-title">FUSE</span>
        <span className="fz2-help">TYPE A WORD WITH THE LETTERS · ENTER</span>
        <div className="fz2-top-r">
          {parts.stack}
          {parts.winsPill}
        </div>
      </div>
      <Lives lives={lives} max={maxLives} words={words} best={best} />
      <div className="fz2-mid">
        <Plate frag={frag} />
        <div className="fz2-type">{parts.form}</div>
        {parts.reason}
        {parts.teach}
      </div>
      <Badge frenzyMs={frenzyMs} frenzyTotalMs={frenzyTotalMs} lit={lit} mult={mult} minutes={minutes} slamKey={slamKey} />
      <Wick frac={frac} secs={secs >= 10 ? String(Math.ceil(secs)) : secs.toFixed(1)} clutch={clutch} warm={warm} dock={dock} />
      <Strip used={used} frag={frag} frenzy={frenzy} />
      {clutch || clutchFlash ? <Hazard flashKey={clutchFlash} /> : null}
      {gain ? <EdgeGain key={gain.key} gain={gain} /> : null}
      {rare ? <EdgeRare key={rare.key} band={rare.band} color={rare.color} /> : null}
    </div>
  );
}
