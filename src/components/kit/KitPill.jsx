// KitPill.jsx — 01 CURRENCY PILLS (claude/mockups/v2/KitCurrency.dc.html): "COUNT-UP · SQUASH ·
// +N STACKS · SHAKE".
//
//   <KitPill ref={r} kind="gems" value={gems} />
//   r.current.deny(41)          // can't afford: shake + red flash + "NEED 41 MORE"
//   r.current.iconEl()          // the icon, for <KitFlyLayer target> / <GainLayer target>
//   r.current.bump()            // a gain particle landed: 1 → 1.12 → 1 in 180 ms (NIGHT oct8 #3)
//   r.current.countNext(ms)     // the NEXT gain counts over `ms` (gains/gainPlan countMs), then back to the default
//
// The pill is VALUE-DRIVEN: when `value` goes up it counts up (700 ms, number turns yellow while it
// counts, then lands with a bump), the icon squashes, a sheen crosses, and a "+N" pops above — gains
// inside 750 ms of each other STACK into one pop with a ×n chip. When `value` goes down it counts
// down (320 ms), the icon dips and a "−N" drops below. Every number is formatNum'd; the pill's own figure is
// formatShort'd (always abbreviated) and SHRINKS TO FIT (Andy oct8): the free width and one glyph's width are
// measured on mount / resize only, so a text write just sets a scale on the number's wrapper (floor FIT_FLOOR).
// Frames write text/transform straight to the DOM (no React render per frame); the pop and the
// NEED tag are single pooled nodes.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import KitIcon from './KitIcon.jsx';
import { createCountTween, COUNT_GAIN_MS, COUNT_SPEND_MS } from './countTween.js';
import { FX, fx, fxOrShow, kitPlay } from './motion.js';
import { formatNum, formatShort } from '../../format.js';
import './tokens.css';
import './KitPill.css';

export const PILL_KINDS = {
  wins: { label: 'WINS', icon: 'wins', tone: 'gold' },
  gems: { label: 'GEMS', icon: 'gems', tone: 'cyan' },
  levels: { label: 'LEVELS', icon: 'levels', tone: 'purple' },
};
export const POP_STACK_MS = 750;
// the gain BUMP (gains/gainPlan.js BUMP_MS / BUMP_SCALE — inlined: the pill is on the menu's first paint, the gain
// module is not)
const BUMP_MS = 180;
const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' , offset: 0.4 }, { transform: 'scale(1)' }];
export const FIT_FLOOR = 0.6; // the smallest the figure may shrink to (a 31px numeral stays ≥ 18px)

/** The scale that fits `len` glyphs of width `cw` into `avail` px — 1 when it fits, never under FIT_FLOOR. */
export function fitScale(len, cw, avail) {
  if (!(len > 0 && cw > 0 && avail > 0)) return 1;
  return Math.max(FIT_FLOOR, Math.min(1, avail / (len * cw)));
}

export const KitPill = forwardRef(function KitPill({ kind = 'gems', value = 0, label, icon, tone, className, ariaLabel }, ref) {
  const k = PILL_KINDS[kind] || PILL_KINDS.gems;
  const rootRef = useRef(null);
  const bodyRef = useRef(null);
  const numRef = useRef(null);
  const sheenRef = useRef(null);
  const flashRef = useRef(null);
  const sqRef = useRef(null);
  const dipRef = useRef(null);
  const iconRef = useRef(null);
  const popRef = useRef(null);
  const popTextRef = useRef(null);
  const popNRef = useRef(null);
  const needRef = useRef(null);
  // React renders the FIRST value only; after that the tween owns the text node (a re-render must
  // never snap a running count to its target).
  const initialText = useRef(formatShort(value)).current;
  const wrapRef = useRef(null);
  // SHRINK-TO-FIT: { avail, cw } measured on mount / resize (never per frame); fit() is a pure write
  const fitM = useRef({ avail: 0, cw: 0, s: 1 });
  const fit = (text) => {
    const m = fitM.current;
    const sc = fitScale(text.length, m.cw, m.avail);
    if (sc !== m.s && wrapRef.current) {
      m.s = sc;
      wrapRef.current.style.transform = sc < 1 ? `scale(${sc.toFixed(3)})` : '';
    }
  };
  const nextMs = useRef(0); // a one-shot count duration for the next gain (GainLayer's first landing sets it)
  const st = useRef({ prev: value, pop: { at: -1e9, dir: 0, amt: 0, n: 0 }, landDir: 1, gaining: false, denyT: 0 });

  const tween = useRef(null);
  if (!tween.current) {
    tween.current = createCountTween({
      initial: value,
      onFrame: (v) => {
        const el = numRef.current;
        if (!el) return;
        const t = formatShort(v);
        if (el.textContent !== t) {
          el.textContent = t; // a text write only when the figure changes
          fit(t);
        }
        const counting = !!(tween.current && tween.current.running);
        if (el.classList.contains('is-counting') !== counting) el.classList.toggle('is-counting', counting);
      },
      onDone: () => {
        const el = numRef.current;
        if (!el) return;
        el.classList.remove('is-counting');
        if (st.current.gaining) {
          st.current.landDir = -st.current.landDir;
          fx(el, FX.land(st.current.landDir));
        }
      },
    });
  }
  useEffect(() => () => tween.current && tween.current.cancel(), []);

  // measure the free width (box minus the icon's overhang and the right inset) and one glyph's width — on mount
  // and on resize only. offsetWidth is the untransformed layout width, so a running scale never skews it.
  useEffect(() => {
    const box = bodyRef.current;
    const num = numRef.current;
    const wrap = wrapRef.current;
    const icon = iconRef.current;
    if (!box || !num || !wrap) return undefined;
    const measure = () => {
      const bw = box.offsetWidth;
      const right = bw - (wrap.offsetLeft + wrap.offsetWidth); // the wrapper's right inset
      const iconEnd = icon ? icon.offsetLeft + icon.offsetWidth : 0;
      const len = (num.textContent || '').length || 1;
      fitM.current.avail = bw - right - Math.max(0, iconEnd) - 4;
      fitM.current.cw = num.offsetWidth / len;
      fitM.current.s = -1; // force the write
      fit(num.textContent || '');
    };
    measure();
    // Andy oct9 ("make sure things fit"): the glyph width was measured in the FALLBACK font — Bungee lands later and is
    // wider, so "1.23M" ran under the coin. Measure once more when the display font is in.
    let live = true;
    const onFonts = () => { if (live) measure(); };
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    if (fonts && fonts.ready) fonts.ready.then(onFonts);
    if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', onFonts); // a webfont that starts loading later
    if (typeof ResizeObserver === 'undefined') return () => { live = false; if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', onFonts); };
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => { live = false; ro.disconnect(); if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', onFonts); };
  }, []);

  useEffect(() => {
    const s = st.current;
    const d = value - s.prev;
    s.prev = value;
    if (!d || !Number.isFinite(d)) return;
    const up = d > 0;
    s.gaining = up;
    const gainMs = nextMs.current > 0 ? nextMs.current : COUNT_GAIN_MS;
    nextMs.current = 0;
    tween.current.to(value, up ? gainMs : COUNT_SPEND_MS);
    if (up) {
      fx(sqRef.current, FX.squashIcon);
      fx(sheenRef.current, FX.sheen);
    } else {
      fx(dipRef.current, FX.dip);
    }
    // the +N / −N pop — stacks within 750 ms of the last one in the same direction
    const now = performance.now();
    const p = s.pop;
    const dir = up ? 1 : -1;
    if (p.dir === dir && now - p.at < POP_STACK_MS) {
      p.amt += Math.abs(d);
      p.n += 1;
    } else {
      p.amt = Math.abs(d);
      p.n = 1;
    }
    p.dir = dir;
    p.at = now;
    const pop = popRef.current;
    if (pop) {
      pop.classList.toggle('is-up', up);
      pop.classList.toggle('is-down', !up);
      popTextRef.current.textContent = `${up ? '+' : '−'}${formatNum(p.amt)}`;
      popNRef.current.textContent = `×${p.n}`;
      popNRef.current.hidden = p.n < 2;
      fxOrShow(pop, up ? FX.popUp : FX.popDown);
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    /** Can't afford: shake, red flash, number red, "NEED {short} MORE" under the pill. */
    deny(short) {
      fx(bodyRef.current, FX.shake);
      fx(flashRef.current, FX.flashHot);
      const n = numRef.current;
      if (n) {
        n.classList.add('is-deny');
        clearTimeout(st.current.denyT);
        st.current.denyT = setTimeout(() => n.classList.remove('is-deny'), 520);
      }
      const need = needRef.current;
      if (need) {
        need.textContent = Number.isFinite(short) ? `NEED ${formatNum(Math.ceil(short))} MORE` : String(short || 'NOT ENOUGH');
        fxOrShow(need, FX.need);
      }
    },
    /** A gain particle landed: the body bumps 1 → 1.12 → 1 (180 ms, transform only; a re-trigger restarts it). */
    bump() {
      kitPlay(bodyRef.current, BUMP, { duration: BUMP_MS, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    },
    /** The next gain's count-up runs `ms` (the default COUNT_GAIN_MS after that). */
    countNext(ms) {
      nextMs.current = Number.isFinite(ms) && ms > 0 ? ms : 0;
    },
    iconEl: () => iconRef.current,
    el: () => rootRef.current,
  }));
  useEffect(() => () => clearTimeout(st.current.denyT), []);

  const name = label || k.label;
  return (
    <div ref={rootRef} className={`kp kp-tone-${tone || k.tone}${className ? ` ${className}` : ''}`} role="group" aria-label={ariaLabel || `${name} ${formatNum(value)}`} data-value={value}>
      <div className="kp-name" aria-hidden="true">{name}</div>
      <div ref={bodyRef} className="kp-body">
        <div className="kp-box">
          <div className="kp-hi" aria-hidden="true" />
          <div className="kp-lo" aria-hidden="true" />
          <div ref={sheenRef} className="kp-sheen" aria-hidden="true" />
          <div ref={flashRef} className="kp-flash" aria-hidden="true" />
          <div ref={wrapRef} className="kp-numwrap">
            <span ref={numRef} className="kp-num" aria-hidden="true">
              {initialText}
            </span>
          </div>
        </div>
        <div ref={iconRef} className="kp-icon">
          <div ref={sqRef} className="kp-sq">
            <div ref={dipRef} className="kp-dip">
              <KitIcon name={icon || k.icon} size={64} shadow={3} extras={false} />
            </div>
          </div>
        </div>
      </div>
      <div ref={popRef} className="kp-pop" aria-hidden="true">
        <span ref={popTextRef} className="kp-pop-t" />
        <span ref={popNRef} className="kp-pop-n" hidden />
      </div>
      <div ref={needRef} className="kp-need" role="status" aria-live="polite" />
    </div>
  );
});
