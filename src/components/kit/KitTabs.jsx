// KitTabs.jsx — 04 TABS (claude/mockups/v2/KitButtons.dc.html).
//
// KitSlabTabs   2-SEG · a slot with a SLIDING SLAB — 340 ms overshoot + a squash on arrival.
// KitPlateTabs  3-SEG PLATES — the picked one grows 16 → 22, lifts, takes its colour; an underline
//               bar + pointer slides under it.
//
// Both are WAI-ARIA tablists: roving tabindex, ←/→/Home/End move AND select (automatic activation).
import { useEffect, useRef } from 'react';
import { FX, fx } from './motion.js';
import './motionMore.js';
import './tokens.css';
import './KitTabs.css';

const cx = (...a) => a.filter(Boolean).join(' ');

function useTabKeys(count, value, onChange) {
  const refs = useRef([]);
  const onKeyDown = (e) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (value + 1) % count;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (value - 1 + count) % count;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = count - 1;
    if (next === null) return;
    e.preventDefault();
    if (onChange) onChange(next);
    const el = refs.current[next];
    if (el) el.focus();
  };
  return { refs, onKeyDown };
}

/**
 * @param {object} p
 * @param {string[]} p.options
 * @param {number} p.value                selected index
 * @param {(i:number)=>void} p.onChange
 * @param {string} p.label                the tablist's accessible name
 */
export function KitSlabTabs({ options, value = 0, onChange, label, idBase = 'kst', className }) {
  const slabRef = useRef(null);
  const first = useRef(true);
  const { refs, onKeyDown } = useTabKeys(options.length, value, onChange);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    fx(slabRef.current, FX.squash);
  }, [value]);
  return (
    <div className={cx('kt-slab', className)} role="tablist" aria-label={label} style={{ '--kt-n': options.length, '--kt-i': value }}>
      <span className="kt-slab-shade" />
      <span className="kt-slab-slider" aria-hidden="true">
        <span ref={slabRef} className="kt-slab-face">
          <span className="kt-slab-shadeband" />
          <span className="kt-slab-glint" />
        </span>
      </span>
      <div className="kt-slab-row">
        {options.map((o, i) => (
          <button
            key={o}
            ref={(el) => { refs.current[i] = el; }}
            id={`${idBase}-${i}`}
            type="button"
            role="tab"
            aria-selected={i === value}
            tabIndex={i === value ? 0 : -1}
            className={cx('kt-slab-opt', i === value && 'is-on')}
            onClick={() => onChange && onChange(i)}
            onKeyDown={onKeyDown}
          >
            <span className="kt-slab-lab">{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * @param {object} p
 * @param {{label:string, tone:string, w:number}[]} p.options   tone: a kit colour token suffix (yellow / cyan / lilac …)
 */
export function KitPlateTabs({ options, value = 0, onChange, label, idBase = 'kpt', className }) {
  const { refs, onKeyDown } = useTabKeys(options.length, value, onChange);
  const lefts = [];
  let acc = 0;
  for (const o of options) {
    lefts.push(acc);
    acc += o.w + 14;
  }
  const sel = options[value] || options[0];
  return (
    <div className={cx('kt-plates', className)} role="tablist" aria-label={label} style={{ width: `${acc - 14}px` }}>
      {options.map((o, i) => (
        <button
          key={o.label}
          ref={(el) => { refs.current[i] = el; }}
          id={`${idBase}-${i}`}
          type="button"
          role="tab"
          aria-selected={i === value}
          tabIndex={i === value ? 0 : -1}
          className={cx('kt-plate', `kt-c-${o.tone}`, i === value && 'is-on')}
          style={{ left: `${lefts[i]}px`, width: `${o.w}px` }}
          onClick={() => onChange && onChange(i)}
          onKeyDown={onKeyDown}
        >
          <span className="kt-plate-lab">{o.label}</span>
        </button>
      ))}
      <span className={cx('kt-under', `kt-c-${sel.tone}`)} style={{ width: `${sel.w}px`, transform: `translateX(${lefts[value]}px)` }} aria-hidden="true">
        <svg width="18" height="12" viewBox="0 0 18 12" focusable="false">
          <path d="M2 11 L9 2 L16 11 Z" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
