// KitPill.jsx — 01 CURRENCY PILLS (claude/mockups/v2/KitCurrency.dc.html): "COUNT-UP · SQUASH ·
// +N STACKS · SHAKE".
//
//   <KitPill ref={r} kind="gems" value={gems} />
//   r.current.deny(41)          // can't afford: shake + red flash + "NEED 41 MORE"
//   r.current.iconEl()          // the icon, for <KitFlyLayer target>
//
// The pill is VALUE-DRIVEN: when `value` goes up it counts up (700 ms, number turns yellow while it
// counts, then lands with a bump), the icon squashes, a sheen crosses, and a "+N" pops above — gains
// inside 750 ms of each other STACK into one pop with a ×n chip. When `value` goes down it counts
// down (320 ms), the icon dips and a "−N" drops below. Every number is formatNum'd.
// Frames write text/transform straight to the DOM (no React render per frame); the pop and the
// NEED tag are single pooled nodes.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import KitIcon from './KitIcon.jsx';
import { createCountTween, COUNT_GAIN_MS, COUNT_SPEND_MS } from './countTween.js';
import { FX, fx, fxOrShow } from './motion.js';
import { formatNum } from '../../format.js';
import './tokens.css';
import './KitPill.css';

export const PILL_KINDS = {
  wins: { label: 'WINS', icon: 'wins', tone: 'gold' },
  gems: { label: 'GEMS', icon: 'gems', tone: 'cyan' },
  levels: { label: 'LEVELS', icon: 'levels', tone: 'purple' },
};
export const POP_STACK_MS = 750;

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
  const initialText = useRef(formatNum(value)).current;
  const st = useRef({ prev: value, pop: { at: -1e9, dir: 0, amt: 0, n: 0 }, landDir: 1, gaining: false, denyT: 0 });

  const tween = useRef(null);
  if (!tween.current) {
    tween.current = createCountTween({
      initial: value,
      onFrame: (v) => {
        const el = numRef.current;
        if (!el) return;
        const t = formatNum(v);
        if (el.textContent !== t) el.textContent = t; // a text write only when the figure changes
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

  useEffect(() => {
    const s = st.current;
    const d = value - s.prev;
    s.prev = value;
    if (!d || !Number.isFinite(d)) return;
    const up = d > 0;
    s.gaining = up;
    tween.current.to(value, up ? COUNT_GAIN_MS : COUNT_SPEND_MS);
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
          <div className="kp-hi" />
          <div className="kp-lo" />
          <div ref={sheenRef} className="kp-sheen" />
          <div ref={flashRef} className="kp-flash" />
          <div className="kp-numwrap">
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
