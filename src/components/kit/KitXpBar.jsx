// KitXpBar.jsx — 01 MENU XP BAR (claude/mockups/v2/KitBars.dc.html): "A · GHOST LEADS  B · FILL
// CHASES  C · FLASH PER LEVEL  D · 6+ LEVELS COMPRESS", "FILL = SCALEX", "WRAP CAP 1S".
//
//   <KitXpBar level={lv} frac={0.69} need={35000} />
//
// The GHOST jumps straight to where the bar is going (full while levels remain, then the real
// fraction); the FILL chases it on lib/barPlan's plan (kit/climb.js — one flash per level, chunked
// past 30, the whole climb ≤ 1 s); every level crossed FLASHES the bar and BUMPS the LV numeral, and
// a "+N LEVELS" chip counts them. Fill / ghost / edge are scaleX / translateX writes on one rAF loop
// (no React render per frame, no layout reads). REDUCE MOTION lands instantly.
//
// P9a (KitLevelUp.dc.html 01 "XP BAR LEVEL-UP"): A · fill to cap, B · WHITE SWEEP + WRAP, C · LV tick bump,
// D · MULTI = CHIP, 3 WRAPS MAX — a multi-level gain wraps at most 3 times (climb.js MAX_WRAPS) and the "+N LV" chip
// slides out from UNDER the bar's left end with the running count. A single level wraps once, no chip.
//
// The root carries data-state ('climb' | 'rest') and data-climb-ms (the last climb's duration) for
// tests and the gallery.
import { useEffect, useRef } from 'react';
import { createClimbPlayer } from './climb.js';
import { FX, fx, kitHold, kitPlay } from './motion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitXpBar.css';

export const GAIN_HIDE_MS = 1400;
const SWEEP = [{ transform: 'translateX(-140%) skewX(-20deg)' }, { transform: 'translateX(560%) skewX(-20deg)' }];
const CHIP_IN = [{ transform: 'translateY(-30px) skewX(-10deg)', opacity: 0 }, { transform: 'translateY(4px) skewX(-10deg)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0) skewX(-10deg)', opacity: 1 }];

export function KitXpBar({ level = 1, frac = 0, need = 1000, unit = 'XP', className, onClimbDone }) {
  const rootRef = useRef(null);
  const lvRef = useRef(null);
  const gainRef = useRef(null);
  const ghostRef = useRef(null);
  const ghostLoRef = useRef(null);
  const fillRef = useRef(null);
  const edgeRef = useRef(null);
  const flashRef = useRef(null);
  const sweepRef = useRef(null);
  const climbN = useRef(0); // levels the current climb crosses (the chip shows only for a multi-level gain)
  const curRef = useRef(null);
  const needRef = useRef(need);
  needRef.current = need;
  const doneCb = useRef(onClimbDone);
  doneCb.current = onClimbDone;
  const gain = useRef({ n: 0, t: 0 });
  const initial = useRef({ lv: formatNum(Math.max(1, Math.floor(level))), cur: formatNum((frac > 0 ? Math.min(1, frac) : 0) * need) }).current;

  // the climb's moving layers are promoted for the life of a climb only (never at rest)
  const promote = (on) => {
    for (const r of [fillRef, edgeRef, ghostRef, ghostLoRef]) if (r.current) r.current.style.willChange = on ? 'transform' : '';
    kitHold([lvRef.current, flashRef.current, gainRef.current, sweepRef.current], on);
  };
  const writeGhost = (g) => {
    const s = `scaleX(${g})`;
    if (ghostRef.current) ghostRef.current.style.transform = s;
    if (ghostLoRef.current) ghostLoRef.current.style.transform = s;
  };

  const player = useRef(null);
  if (!player.current) {
    player.current = createClimbPlayer({
      level,
      frac,
      onFrame: (l, f) => {
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${f})`;
        if (edgeRef.current) {
          edgeRef.current.style.transform = `translateX(${f * 100}%)`;
          edgeRef.current.style.opacity = f > 0.004 ? '1' : '0';
        }
        const cur = curRef.current;
        if (cur) {
          const t = formatNum(f * needRef.current);
          if (cur.textContent !== t) cur.textContent = t; // a text write only when the figure changes
        }
      },
      onLevel: (l, prev) => {
        if (lvRef.current) {
          const t = formatNum(l);
          if (lvRef.current.textContent !== t) lvRef.current.textContent = t;
          fx(lvRef.current, FX.barBump);
        }
        fx(flashRef.current, FX.barFlash);
        kitPlay(sweepRef.current, SWEEP, { duration: 380, easing: 'cubic-bezier(.3,0,.2,1)' });
        const p = player.current;
        if (p && l >= p.target.level) writeGhost(p.target.frac);
        if (l > prev) {
          const g = gain.current;
          clearTimeout(g.t);
          const was = g.n;
          g.n += l - prev;
          const chip = gainRef.current;
          if (chip && (g.n > 1 || climbN.current > 1)) {
            const t = chip.firstChild;
            if (t) t.textContent = `+${formatNum(g.n)} LV`;
            const fresh = !chip.classList.contains('is-on');
            chip.classList.add('is-on');
            if (fresh || was === 0) kitPlay(chip, CHIP_IN, { duration: 280, easing: 'cubic-bezier(.2,1.2,.4,1)' });
            else fx(t, FX.barBump);
          }
        }
      },
      onDone: (l, f, ms) => {
        promote(false);
        const root = rootRef.current;
        if (root) {
          root.dataset.state = 'rest';
          root.dataset.climbMs = String(Math.round(ms));
        }
        if (lvRef.current && lvRef.current.textContent !== formatNum(l)) lvRef.current.textContent = formatNum(l);
        writeGhost(f);
        const g = gain.current;
        clearTimeout(g.t);
        g.t = setTimeout(() => {
          g.n = 0;
          if (gainRef.current) gainRef.current.classList.remove('is-on');
        }, GAIN_HIDE_MS);
        if (doneCb.current) doneCb.current(l, f, ms);
      },
    });
  }

  useEffect(() => {
    const p = player.current;
    const root = rootRef.current;
    // the ghost LEADS: full while there are levels to cross, else straight to the target fraction
    const tl = Math.max(1, Math.floor(level));
    const tf = frac > 0 ? Math.min(1, frac) : 0;
    const climbing = tl > p.level || (tl === p.level && tf > p.frac);
    climbN.current = tl > p.level ? tl - p.level + gain.current.n : 0;
    if (root && climbing) root.dataset.state = 'climb';
    if (climbing) promote(true);
    writeGhost(tl > p.level ? 1 : tf);
    p.to(level, frac);
  }, [level, frac]);

  useEffect(() => {
    const p = player.current;
    // first paint: the bar already shows where it is
    p.set(p.target.level, p.target.frac);
    const g = gain.current;
    return () => {
      p.cancel();
      clearTimeout(g.t);
    };
  }, []);

  return (
    <div ref={rootRef} className={`kx${className ? ` ${className}` : ''}`} data-state="rest">
      <div className="kx-lv">
        <span className="kx-lv-k">LV</span>
        <span ref={lvRef} className="kx-lv-n">
          {initial.lv}
        </span>
      </div>
      <div className="kx-barwrap">
        <span ref={gainRef} className="kx-gain" aria-hidden="true">
          <span className="kx-gain-t" />
        </span>
        <div className="kx-bar" role="progressbar" aria-label={`Level ${formatNum(level)} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((frac > 0 ? Math.min(1, frac) : 0) * 100)}>
          <div className="kx-ticks" aria-hidden="true" />
          <div className="kx-low" aria-hidden="true" />
          <div ref={ghostRef} className="kx-ghost" aria-hidden="true" />
          <div ref={ghostLoRef} className="kx-ghost-low" aria-hidden="true" />
          <div ref={fillRef} className="kx-fill" aria-hidden="true">
            <div className="kx-fill-hi" aria-hidden="true" />
            <div className="kx-fill-lo" aria-hidden="true" />
          </div>
          <div className="kx-ticks-low" aria-hidden="true" />
          <div className="kx-mid" aria-hidden="true" />
          <div ref={edgeRef} className="kx-edge" aria-hidden="true">
            <div className="kx-edge-w" aria-hidden="true" />
            <div className="kx-edge-b" aria-hidden="true" />
          </div>
          <div ref={flashRef} className="kx-flash" aria-hidden="true" />
          <div ref={sweepRef} className="kx-sweep" aria-hidden="true" />
          <div className="kx-read" aria-hidden="true">
            <span ref={curRef} className="kx-read-n">
              {initial.cur}
            </span>
            <span className="kx-read-s">/</span>
            <span className="kx-read-n">{formatNum(need)}</span>
            <span className="kx-read-u">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
