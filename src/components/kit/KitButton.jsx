// KitButton.jsx — the v2 BUTTONS (claude/mockups/v2/KitButtons.dc.html, sections 01–03 + 05).
//
// KitButton       01 PRIMARY ACTION — a skewed FACE sitting on a coloured LIP over a hard black
//                 shadow. Hover lifts the face (−4, 250 ms overshoot), press slams it into the lip
//                 (+11 in 34 ms, back up over 600 ms). `disabled` = hatch + lock chip; a tap gives a
//                 dead 3px press + a shake (never fires onClick). `drainMs` runs a cooldown strip.
// KitHoldButton   HOLD TO CONFIRM — the fill crosses the face over 1.0 s while held (pointer, or
//                 Enter / Space held), rattles from 0.55 s, commits at 1.0 s; letting go early
//                 cancels (180 ms drain). Commit flashes the face and floats `confirmText`.
// KitGhostButton  02 GHOST — dark face, the lip colour names the destination.
// KitBackButton   02 BACK — the arrow hull (SVG).
// KitIconButton   02 ICON — a 72px tile; `tag` = a rank sticker, `dot` = a real to-do.
// KitRailButton   03 LEFT RAIL — edge wedge + icon + label; `active` floods it, slides +14 and
//                 slams the pointer in.
// KitCycleButton  05 AUTO ROLL — tap to cycle a set of options; pips show the position.
//
// Every one is a real <button> (focusable, Enter/Space), ≥ 44px, and all motion is transform/opacity.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import KitIcon from './KitIcon.jsx';
import { createHoldConfirm, HOLD_MS, HOLD_SHAKE_AT_MS } from './holdConfirm.js';
import { FX, fx, kitStop } from './motion.js';
import './tokens.css';
import './KitButton.css';

const cx = (...a) => a.filter(Boolean).join(' ');

/** The lock + "NEED 75" chip a disabled primary shows under its label. */
function LockChip({ text, hot }) {
  return (
    <span className={cx('kb-lockchip', hot && 'is-hot')}>
      <svg width="12" height="14" viewBox="0 0 24 28" aria-hidden="true" focusable="false">
        <path d="M6 12 L6 8 C6 2 18 2 18 8 L18 12" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="2" y="12" width="20" height="14" fill="currentColor" />
      </svg>
      {text}
    </span>
  );
}

/** A corner sticker on a primary (READY / −41). */
function Sticker({ tag }) {
  if (!tag) return null;
  const side = tag.side === 'left' ? 'left' : 'right';
  return (
    <span className={cx('kb-sticker', `kb-sticker--${side}`, `kb-tone-${tag.tone || 'hot'}`)} style={{ '--kb-st-rot': `${tag.rot ?? (side === 'left' ? -6 : 6)}deg` }} aria-hidden="true">
      {tag.text}
    </span>
  );
}

function Face({ children, extraGlint = true, hatch = false }) {
  return (
    <span className={cx('kb-face', hatch && 'is-hatch')}>
      {!hatch && <span className="kb-shade" />}
      {!hatch && <span className="kb-glint" />}
      {!hatch && extraGlint && <span className="kb-glint2" />}
      {children}
    </span>
  );
}

const LABEL_FS = { 24: 'kb-fs24', 30: 'kb-fs30', 34: 'kb-fs34', 38: 'kb-fs38' };

/**
 * @param {object} p
 * @param {'yellow'|'cyan'|'gold'|'purple'|'blue'|'pink'} [p.tone='yellow']
 * @param {React.ReactNode} p.label
 * @param {React.ReactNode} [p.sub]          the second line (price, reward)
 * @param {24|30|34|38} [p.labelSize=38]
 * @param {number} [p.width=160]
 * @param {boolean} [p.disabled]             hatch + lock; taps deny instead of firing
 * @param {string} [p.lockText]              the disabled chip ("NEED 75")
 * @param {{text:string, tone?:string, side?:'left'|'right', rot?:number}} [p.tag]
 * @param {number} [p.drainMs] / [p.drainKey]  a cooldown strip that drains once per key
 * @param {'hover'|'pressed'} [p.freeze]     render a frozen state (kit gallery)
 */
export const KitButton = forwardRef(function KitButton(
  { tone = 'yellow', label, sub, labelSize = 38, width = 160, disabled = false, lockText, tag, drainMs, drainKey, freeze, onClick, onDeny, className, ariaLabel, ...rest },
  ref,
) {
  const wrapRef = useRef(null);
  const drainRef = useRef(null);
  const [denyHot, setDenyHot] = useState(false);
  const hotT = useRef(0);
  useEffect(() => () => clearTimeout(hotT.current), []);
  useEffect(() => {
    if (!drainMs || !drainRef.current) return;
    const a = fx(drainRef.current, FX.drain(drainMs));
    if (!a) drainRef.current.style.transform = 'scaleX(0)';
  }, [drainMs, drainKey]);
  const handle = (e) => {
    if (disabled) {
      e.preventDefault();
      fx(wrapRef.current, FX.deny);
      setDenyHot(true);
      clearTimeout(hotT.current);
      hotT.current = setTimeout(() => setDenyHot(false), 400);
      if (onDeny) onDeny(e);
      return;
    }
    if (onClick) onClick(e);
  };
  return (
    <span ref={wrapRef} className={cx('kb-wrap', className)}>
      <button
        ref={ref}
        type="button"
        className={cx('kb', 'kb--primary', `kb-tone-${tone}`, disabled && 'is-off', freeze && `is-${freeze}`)}
        style={{ '--kb-w': `${width}px` }}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        onClick={handle}
        {...rest}
      >
        <span className="kb-shadow" />
        <span className="kb-lip" />
        <Face hatch={disabled}>
          {drainMs ? <span ref={drainRef} key={drainKey} className="kb-drain" /> : null}
          <span className="kb-label">
            <span className={cx('kb-main', LABEL_FS[labelSize] || 'kb-fs38')}>{label}</span>
            {disabled && lockText ? <LockChip text={lockText} hot={denyHot} /> : sub != null ? <span className="kb-sub">{sub}</span> : null}
          </span>
        </Face>
      </button>
      <Sticker tag={tag} />
    </span>
  );
});

/**
 * HOLD TO CONFIRM.
 * @param {object} p
 * @param {() => void} p.onConfirm            fires once, only after the full hold
 * @param {number} [p.holdMs=1000]
 * @param {React.ReactNode} [p.label='HOLD TO BUY'] / [p.holdingLabel='HOLDING'] / [p.sub]
 * @param {string} [p.confirmText]           floats up on commit ("+1 POWER")
 */
export const KitHoldButton = forwardRef(function KitHoldButton(
  { tone = 'gold', label = 'HOLD TO BUY', holdingLabel = 'HOLDING', sub, labelSize = 30, width = 300, holdMs = HOLD_MS, disabled = false, confirmText, onConfirm, onCancel, className, ariaLabel, ...rest },
  ref,
) {
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const fillRef = useRef(null);
  const flashRef = useRef(null);
  const floatRef = useRef(null);
  const [held, setHeld] = useState(false);
  const cbs = useRef({ onConfirm, onCancel });
  cbs.current = { onConfirm, onCancel };
  useImperativeHandle(ref, () => btnRef.current);

  const hold = useMemo(
    () =>
      createHoldConfirm({
        holdMs,
        shakeAt: Math.round((HOLD_SHAKE_AT_MS / HOLD_MS) * holdMs),
        onPhase: (p) => {
          setHeld(p > 0);
          const w = wrapRef.current;
          if (p === 1) fx(w, { ...FX.holdShake1, opts: { ...FX.holdShake1.opts, iterations: Math.ceil((HOLD_SHAKE_AT_MS / HOLD_MS) * holdMs / 90) } });
          else if (p === 2) fx(w, { ...FX.holdShake2, opts: { ...FX.holdShake2.opts, iterations: Math.ceil(((HOLD_MS - HOLD_SHAKE_AT_MS) / HOLD_MS) * holdMs / 60) } });
          else kitStop(w);
        },
        onCommit: () => {
          // snap the fill home under the flash (no drain), then let it transition again
          const f = fillRef.current;
          if (f) {
            f.style.transition = 'none';
            requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = ''; }));
          }
          fx(flashRef.current, FX.flash);
          fx(floatRef.current, FX.float);
          if (cbs.current.onConfirm) cbs.current.onConfirm();
        },
        onCancel: (ms) => {
          if (cbs.current.onCancel) cbs.current.onCancel(ms);
        },
      }),
    [holdMs],
  );
  useEffect(() => () => hold.dispose(), [hold]);
  useEffect(() => {
    if (disabled) hold.end();
  }, [disabled, hold]);

  const start = () => {
    if (!disabled) hold.start();
  };
  const end = () => hold.end();
  const onKeyDown = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    end();
  };
  return (
    <span ref={wrapRef} className={cx('kb-wrap', className)}>
      <button
        ref={btnRef}
        type="button"
        className={cx('kb', 'kb--primary', 'kb--hold', `kb-tone-${tone}`, held && 'is-held', disabled && 'is-off')}
        style={{ '--kb-w': `${width}px`, '--kb-hold-ms': `${holdMs}ms` }}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
        aria-pressed={held}
        data-holding={held ? '1' : undefined}
        onPointerDown={(e) => {
          if (e.button === 0) start();
        }}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={end}
        onClick={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        {...rest}
      >
        <span className="kb-shadow" />
        <span className="kb-lip" />
        <Face hatch={disabled} extraGlint={false}>
          {!disabled && (
            <span className="kb-holdclip" aria-hidden="true">
              <span ref={fillRef} className="kb-holdfill" />
            </span>
          )}
          {!disabled && <span className="kb-tick kb-tick--25" />}
          {!disabled && <span className="kb-tick kb-tick--50" />}
          {!disabled && <span className="kb-tick kb-tick--75" />}
          <span className="kb-label">
            <span className={cx('kb-main', LABEL_FS[labelSize] || 'kb-fs30')}>{held ? holdingLabel : label}</span>
            {sub != null && <span className="kb-sub">{sub}</span>}
          </span>
          <span ref={flashRef} className="kb-flash" />
        </Face>
      </button>
      {confirmText ? (
        <span ref={floatRef} className="kb-float" aria-hidden="true">
          {confirmText}
        </span>
      ) : null}
    </span>
  );
});

/** 02 GHOST — `tone` is the lip colour (where it takes you); `count` an optional yellow figure. */
export function KitGhostButton({ label, count, tone = 'cyan', onClick, className, ariaLabel, freeze, ...rest }) {
  return (
    <button type="button" className={cx('kb', 'kb--ghost', `kb-tone-${tone}`, freeze && `is-${freeze}`, className)} onClick={onClick} aria-label={ariaLabel} {...rest}>
      <span className="kb-shadow" />
      <span className="kb-glip" />
      <span className="kb-gface">
        <span className="kb-glabel">
          <span className="kb-gtext">{label}</span>
          {count != null && <span className="kb-gcount">{count}</span>}
        </span>
      </span>
    </button>
  );
}

/** 02 BACK — the arrow hull. */
export function KitBackButton({ label = 'MENU', onClick, className, ariaLabel = 'Back', ...rest }) {
  return (
    <button type="button" className={cx('kb', 'kb--back', className)} onClick={onClick} aria-label={ariaLabel} {...rest}>
      <svg viewBox="0 0 184 76" width="184" height="76" aria-hidden="true" focusable="false">
        <polygon points="10,37 32,8 176,8 168,68 32,68" fill="#000" transform="translate(6 6)" />
        <g className="kb-bface">
          <polygon points="4,35 28,4 174,4 166,64 28,64" fill="#1a0b2e" stroke="#000" strokeWidth="5" strokeLinejoin="miter" />
          <polygon points="152,4 174,4 166,64 144,64" fill="#FFE94A" stroke="#000" strokeWidth="4" />
          <path className="kb-chev" d="M16 34 L34 12 L46 12 L28 34 L46 56 L34 56 Z" fill="#fff" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
          <path d="M30 8 L150 8" stroke="#3a2160" strokeWidth="4" />
          <text x="96" y="46" textAnchor="middle" fontFamily="Bungee" fontSize="26" fill="#fff" stroke="#000" strokeWidth="5" paintOrder="stroke">
            {label}
          </text>
        </g>
      </svg>
    </button>
  );
}

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

/**
 * 05 AUTO ROLL — cycles `options` ({label, tone}) on each tap. Pips show the position.
 * The first option is the "off" state (dark face).
 */
export function KitCycleButton({ options, index = 0, onChange, ariaLabel, className, ...rest }) {
  const labelRef = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    fx(labelRef.current, FX.slamSmall);
  }, [index]);
  const o = options[index] || options[0];
  const steps = options.length - 1;
  const next = useCallback(() => {
    if (onChange) onChange((index + 1) % options.length);
  }, [index, onChange, options.length]);
  return (
    <button type="button" className={cx('kb', 'kb--cycle', `kb-tone-${o.tone || 'off'}`, className)} onClick={next} aria-label={ariaLabel ? `${ariaLabel}: ${o.label}` : undefined} {...rest}>
      <span className="kb-shadow" />
      <span className="kb-lip" />
      <span className="kb-cface">
        <span ref={labelRef} className={cx('kb-clabel', String(o.label).length > 8 && 'is-long')}>
          {o.label}
        </span>
        <span className="kb-pips" aria-hidden="true">
          {Array.from({ length: steps }, (_, i) => {
            const k = i + 1;
            const st = index === 0 ? 'none' : k < index ? 'past' : k === index ? 'now' : 'ahead';
            return <span key={k} className={`kb-pip is-${st}`} />;
          })}
        </span>
      </span>
    </button>
  );
}
