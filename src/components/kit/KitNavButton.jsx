// KitNavButton.jsx — the v2 02 ICON tile + 03 LEFT RAIL buttons (claude/mockups/v2/KitButtons.dc.html),
// split from KitButton.jsx (which re-exports both) so a screen that needs only these — the menu — loads
// only these and the shared button base (KitNavButton.css). Real <button>s, ≥ 44px, transform/opacity only.
import { useEffect, useRef } from 'react';
import KitIcon from './KitIcon.jsx';
import { FX, fx } from './motion.js';
import './tokens.css';
import './KitNavButton.css';

const cx = (...a) => a.filter(Boolean).join(' ');

/**
 * 02 ICON tile. `tag` = rank sticker text (#4); `dot` = a count (or true) for a real to-do.
 */
export function KitIconButton({ icon, tone = 'yellow', rot = 0, tag, tagTone, dot, ariaLabel, onClick, className, ...rest }) {
  const dotRef = useRef(null);
  const tagRef = useRef(null);
  const hasDot = dot != null && dot !== false && dot !== 0;
  useEffect(() => {
    if (hasDot && dotRef.current) {
      fx(dotRef.current, FX.dotIn);
    }
  }, [hasDot]);
  useEffect(() => {
    if (hasDot && dotRef.current) {
      const a = dotRef.current.__kitAnim;
      // one beat after the dot lands (the mockup's 1.4s pulse, played once)
      if (!a) fx(dotRef.current, FX.dotBeat);
    }
  }, [dot, hasDot]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (tag != null) fx(tagRef.current, FX.bump);
  }, [tag]);
  return (
    <button type="button" className={cx('kb', 'kb--icon', `kb-tone-${tone}`, className)} style={{ '--kb-rot': `${rot}deg` }} onClick={onClick} aria-label={ariaLabel} {...rest}>
      <span className="kb-shadow" />
      <span className="kb-lip" />
      <span className="kb-iface">
        <span className="kb-ibar" />
        <KitIcon name={icon} size={44} shadow={2} extras={false} />
      </span>
      {tag != null && (
        <span ref={tagRef} className={cx('kb-itag', `kb-tone-${tagTone || 'yellow'}`)}>
          {tag}
        </span>
      )}
      {hasDot && (
        <span ref={dotRef} className="kb-idot" aria-hidden="true">
          {dot === true ? '' : dot}
        </span>
      )}
    </button>
  );
}

/**
 * 03 LEFT RAIL item. `tone` / `toneD` = the destination colour and its shade.
 */
export function KitRailButton({ icon, label, tone = 'yellow', active = false, dot = false, onClick, className, ...rest }) {
  const ptrRef = useRef(null);
  const dotRef = useRef(null);
  useEffect(() => {
    if (active) fx(ptrRef.current, FX.slamSmall);
  }, [active]);
  useEffect(() => {
    if (dot && !active) fx(dotRef.current, FX.dotIn);
  }, [dot, active]);
  return (
    <span className={cx('kb-rwrap', active && 'is-active', className)}>
      <button type="button" className={cx('kb', 'kb--rail', `kb-tone-${tone}`, active && 'is-active')} aria-current={active ? 'page' : undefined} onClick={onClick} {...rest}>
        <span className="kb-shadow" />
        <span className="kb-rface">
          <span className="kb-redge" />
          <KitIcon name={icon} size={28} shadow={2} extras={false} />
          <span className="kb-rlabel">{label}</span>
        </span>
      </button>
      {active && (
        <svg ref={ptrRef} className={cx('kb-rptr', `kb-tone-${tone}`)} width="22" height="30" viewBox="0 0 22 30" aria-hidden="true" focusable="false">
          <path d="M2 3 L19 15 L2 27 Z" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
        </svg>
      )}
      {dot && !active && <span ref={dotRef} className="kb-rdot" aria-hidden="true" />}
    </span>
  );
}

