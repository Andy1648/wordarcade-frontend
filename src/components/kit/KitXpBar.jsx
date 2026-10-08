// KitXpBar.jsx — 01 MENU XP BAR (claude/mockups/v2/KitBars.dc.html), "FILL = SCALEX", "WRAP CAP 1S".
//
//   <KitXpBar level={lv} frac={0.69} need={35000} />
//
// ANDY (oct6, "smooth and clean"): THREE layers — a dark track, ONE solid yellow fill with a single
// thin top highlight, a black ink outline. SEASON 2 list item 5: EVERY gain GLIDES ~600 ms ease-out
// (kit/climb.js — one continuous position, retargeted mid-glide from the position AND speed on screen,
// so typing fast is one slow continuous climb, never steps). A LEVEL WRAP is the same glide crossing
// full: a soft 280 ms white SWEEP crosses the bar (one pooled node, transform/opacity only), the fill
// carries on from 0; the LV numeral BUMPS and a "+N LEVELS" chip counts them. Big climbs compress
// (600 ms + 200 ms a level, ≤ 1 s whole). The fill is a scaleX write on one rAF loop that sleeps at
// rest (no React render per frame, no layout reads).
// REDUCE MOTION lands instantly.
//
// The root carries data-state ('climb' | 'rest'), data-climb-ms (the last climb's duration) and
// data-level (the level SHOWN right now) for tests and the gallery.
//
// P9a (KitLevelUp.dc.html 01 "D · MULTI = CHIP"): a gain that crosses MORE than one level shows a "+N LV" chip that
// slides out from UNDER the bar's left end and counts the levels; a single level is the sweep + LV bump alone.
//
// NIGHT oct8 #1b: `lvInside` puts the LV numeral INSIDE the bar, on the bar's own plate at its left edge (the fill
// starts after the plate), and `lead` takes the old LV slot left of the bar (the menu's RANK plate).
import { useEffect, useRef } from 'react';
import { createClimbPlayer } from './climb.js';
import { FX, fx, kitHold, kitStop, kitPlay } from './motion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitXpBar.css';

export const GAIN_HIDE_MS = 1400;
const CHIP_IN = [{ transform: 'translateY(-30px) skewX(-10deg)', opacity: 0 }, { transform: 'translateY(4px) skewX(-10deg)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0) skewX(-10deg)', opacity: 1 }];

export function KitXpBar({ level = 1, frac = 0, need = 1000, unit = 'XP', className, onClimbDone, lvInside = false, lead = null }) {
  const rootRef = useRef(null);
  const lvRef = useRef(null);
  const gainRef = useRef(null);
  const fillRef = useRef(null);
  const sweepRef = useRef(null);
  const curRef = useRef(null);
  const needRef = useRef(need);
  needRef.current = need;
  const doneCb = useRef(onClimbDone);
  doneCb.current = onClimbDone;
  const gain = useRef({ n: 0, t: 0 });
  const climbN = useRef(0); // levels the current climb crosses (the chip is for a MULTI-level gain only)
  const initial = useRef({ lvRaw: String(Math.max(1, Math.floor(level))), lv: formatNum(Math.max(1, Math.floor(level))), cur: formatNum((frac > 0 ? Math.min(1, frac) : 0) * need) }).current;

  // the fill is promoted for the life of a glide only (never at rest); the sweep promotes itself per play
  const promote = (on) => {
    if (fillRef.current) fillRef.current.style.willChange = on ? 'transform' : '';
    kitHold([lvRef.current, gainRef.current], on);
  };
  // one pooled sweep: a wrap that lands while the last sweep is still crossing rides on it (a 30-level
  // climb wraps every ~33 ms — restarting would strobe)
  const sweep = () => {
    const el = sweepRef.current;
    if (el && !el.__kitAnim) fx(el, FX.barSweep);
  };

  const player = useRef(null);
  if (!player.current) {
    player.current = createClimbPlayer({
      level,
      frac,
      onFrame: (l, f) => {
        if (fillRef.current) fillRef.current.style.transform = `scaleX(${f})`;
        const cur = curRef.current;
        if (cur) {
          const t = formatNum(f * needRef.current);
          if (cur.textContent !== t) cur.textContent = t; // a text write only when the figure changes
        }
      },
      onLevel: (l, prev) => {
        if (rootRef.current) rootRef.current.dataset.level = String(l); // the SHOWN level, exact (the numeral is compacted past 1K)
        if (lvRef.current) {
          const t = formatNum(l);
          if (lvRef.current.textContent !== t) lvRef.current.textContent = t;
          fx(lvRef.current, FX.barBump);
        }
        if (l > prev) {
          sweep();
          const g = gain.current;
          clearTimeout(g.t);
          g.n += l - prev;
          const chip = gainRef.current;
          if (chip && (g.n > 1 || climbN.current > 1)) {
            const t = chip.firstChild;
            if (t) t.textContent = `+${formatNum(g.n)} LV`;
            if (!chip.classList.contains('is-on')) {
              chip.classList.add('is-on');
              kitPlay(chip, CHIP_IN, { duration: 280, easing: 'cubic-bezier(.2,1.2,.4,1)' });
            } else fx(t, FX.barBump);
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
    const tl = Math.max(1, Math.floor(level));
    const tf = frac > 0 ? Math.min(1, frac) : 0;
    const climbing = tl > p.level || (tl === p.level && tf > p.frac);
    climbN.current = tl > p.level ? tl - p.level + gain.current.n : 0;
    if (root && climbing) root.dataset.state = 'climb';
    if (climbing) promote(true);
    p.to(level, frac);
  }, [level, frac]);

  useEffect(() => {
    const p = player.current;
    // first paint: the bar already shows where it is
    p.set(p.target.level, p.target.frac);
    const g = gain.current;
    const sw = sweepRef.current;
    return () => {
      p.cancel();
      kitStop(sw);
      clearTimeout(g.t);
    };
  }, []);

  const lvText = (
    <>
      <span className="kx-lv-k">LV</span>
      <span ref={lvRef} className="kx-lv-n">
        {initial.lv}
      </span>
    </>
  );
  // inside the bar the numeral sits on a counter-skewed wrapper, so the LV bump (a transform) never fights the skew
  const lvNode = lvInside ? (
    <div className="kx-lvplate">
      <span className="kx-lvplate-in">{lvText}</span>
    </div>
  ) : (
    <div className="kx-lv">{lvText}</div>
  );
  return (
    <div ref={rootRef} className={`kx${lvInside ? ' is-lvin' : ''}${className ? ` ${className}` : ''}`} data-state="rest" data-level={initial.lvRaw}>
      {lvInside ? lead : lvNode}
      <div className="kx-barwrap">
        <span ref={gainRef} className="kx-gain" aria-hidden="true">
          <span className="kx-gain-t" />
        </span>
        <div className="kx-bar" role="progressbar" aria-label={`Level ${formatNum(level)} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((frac > 0 ? Math.min(1, frac) : 0) * 100)}>
          <div className="kx-track" aria-hidden="true">
            <div ref={fillRef} className="kx-fill">
              <div className="kx-fill-hi" />
            </div>
            <div ref={sweepRef} className="kx-sweep" />
          </div>
          {lvInside && lvNode}
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
