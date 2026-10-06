// KitPops.jsx — 02 NUMBER POPS (claude/mockups/v2/KitCurrency.dc.html): "BIGGER EVENT = BIGGER,
// LONGER, HARDER". Four tiers:
//   S   0.8 s  "+14.3K XP"       a small float — up to POOL_S of them at once (pooled nodes)
//   M   1.3 s  "+75 GEMS"        icon + number spin in
//   L   1.7 s  "+1 LEVEL"        slams down, chevrons rise, the stage shakes
//   XL  2.3 s  "×10 OVERDRIVE"   slams from ×4, bands sweep, the stage flashes + shakes hard
//
//   const stage = useRef();  <KitPopStage ref={stage} />  stage.current.play('m', { text: '+75', unit: 'GEMS' })
//
// M / L / XL are exclusive (a new one replaces the one on stage). Every node already exists — a play
// is pure writes + WAAPI. With REDUCE MOTION the pop is shown, still, for its duration.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import KitIcon from './KitIcon.jsx';
import { FX, fx, fxOrShow, kitStop } from './motion.js';
import './motionMore.js';
import './tokens.css';
import './KitPops.css';

export const POOL_S = 6;
export const POP_MS = { s: 800, m: 1300, l: 1700, xl: 2300 };

export const KitPopStage = forwardRef(function KitPopStage({ idleText = '← TAP A TIER', className, children }, ref) {
  const stageRef = useRef(null);
  const idleRef = useRef(null);
  const sRefs = useRef([]);
  const sText = useRef([]);
  const sUnit = useRef([]);
  const sNext = useRef(0);
  const mRef = useRef(null);
  const mText = useRef(null);
  const mUnit = useRef(null);
  const lRef = useRef(null);
  const lText = useRef(null);
  const lTag = useRef(null);
  const chevRefs = useRef([]);
  const xRef = useRef(null);
  const xText = useRef(null);
  const xSub = useRef(null);
  const xFlash = useRef(null);
  const bandA = useRef(null);
  const bandB = useRef(null);
  const xSubWrap = useRef(null);
  const busyUntil = useRef(0);
  const idleT = useRef(0);
  useEffect(() => () => clearTimeout(idleT.current), []);

  const hideIdle = (ms) => {
    const idle = idleRef.current;
    if (!idle) return;
    idle.style.opacity = '0';
    const until = performance.now() + ms;
    if (until > busyUntil.current) busyUntil.current = until;
    clearTimeout(idleT.current);
    idleT.current = setTimeout(() => { idle.style.opacity = ''; }, busyUntil.current - performance.now());
  };

  const clearBig = () => {
    for (const el of [mRef.current, lRef.current, xRef.current, xFlash.current, bandA.current, bandB.current, xSubWrap.current, ...chevRefs.current]) {
      if (el) {
        kitStop(el);
        el.classList.remove('kit-static-on');
      }
    }
  };

  useImperativeHandle(ref, () => ({
    /**
     * @param {'s'|'m'|'l'|'xl'} tier
     * @param {{text?:string, unit?:string, tag?:string, sub?:string}} [o]
     */
    play(tier, o = {}) {
      if (tier === 's') {
        const i = sNext.current;
        sNext.current = (i + 1) % POOL_S;
        const el = sRefs.current[i];
        if (!el) return;
        sText.current[i].textContent = o.text || '+14.3K';
        sUnit.current[i].textContent = o.unit || 'XP';
        // pure writes: a scatter position inside the stage, in % (no measuring)
        el.style.left = `${50 + (Math.random() * 60 - 30)}%`;
        el.style.top = `${54 + (Math.random() * 34 - 17)}%`;
        fxOrShow(el, FX.popS, POP_MS.s);
        hideIdle(POP_MS.s);
        return;
      }
      clearBig();
      hideIdle(POP_MS[tier] || 1000);
      if (tier === 'm') {
        mText.current.textContent = o.text || '+75';
        mUnit.current.textContent = o.unit || 'GEMS';
        fxOrShow(mRef.current, FX.popM, POP_MS.m);
      } else if (tier === 'l') {
        lText.current.textContent = o.text || '+1';
        lTag.current.textContent = o.tag || 'LEVEL';
        fxOrShow(lRef.current, FX.popL, POP_MS.l);
        chevRefs.current.forEach((c, i) => fx(c, FX.chev([0, 0.25, 0.12, 0.37][i] * 1000)));
        fx(stageRef.current, FX.stageShake1);
      } else if (tier === 'xl') {
        xText.current.textContent = o.text || '×10';
        xSub.current.textContent = o.sub || 'OVERDRIVE';
        fxOrShow(xRef.current, FX.popXL, POP_MS.xl);
        fx(xFlash.current, FX.stageFlash);
        fx(bandA.current, FX.band(200));
        fx(bandB.current, FX.band(300));
        fx(xSubWrap.current, FX.subIn);
        fx(stageRef.current, FX.stageShake2);
      }
    },
  }));

  return (
    <div className={`kps${className ? ` ${className}` : ''}`}>
      <div ref={stageRef} className="kps-stage">
        <div className="kps-grid" />
        <div ref={idleRef} className="kps-idle">{idleText}</div>
        {/* XL backdrop */}
        <div ref={xFlash} className="kps-xflash" />
        <div ref={bandA} className="kps-band kps-band--a" />
        <div ref={bandB} className="kps-band kps-band--b" />
        {/* S pool */}
        {Array.from({ length: POOL_S }, (_, i) => (
          <div key={i} ref={(el) => { sRefs.current[i] = el; }} className="kps-s" aria-hidden="true">
            <span ref={(el) => { sText.current[i] = el; }} className="kps-s-n" />
            <span ref={(el) => { sUnit.current[i] = el; }} className="kps-s-u" />
          </div>
        ))}
        {/* M */}
        <div ref={mRef} className="kps-m" aria-hidden="true">
          <KitIcon name="gems" size={52} shadow={3} extras={false} />
          <span ref={mText} className="kps-m-n" />
          <span ref={mUnit} className="kps-m-u" />
        </div>
        {/* L */}
        <div className="kps-chevs kps-chevs--l" aria-hidden="true">
          {[0, 1].map((i) => (
            <svg key={i} ref={(el) => { chevRefs.current[i] = el; }} className={`kps-chev kps-chev--${i ? 'b' : 'a'}`} viewBox="0 0 40 24" width="44" height="26" focusable="false">
              <path d="M4 20 L20 6 L36 20" stroke="#000" strokeWidth="10" fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M4 20 L20 6 L36 20" strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          ))}
        </div>
        <div className="kps-chevs kps-chevs--r" aria-hidden="true">
          {[2, 3].map((i) => (
            <svg key={i} ref={(el) => { chevRefs.current[i] = el; }} className={`kps-chev kps-chev--${i === 3 ? 'b' : 'a'}`} viewBox="0 0 40 24" width="44" height="26" focusable="false">
              <path d="M4 20 L20 6 L36 20" stroke="#000" strokeWidth="10" fill="none" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M4 20 L20 6 L36 20" strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          ))}
        </div>
        <div ref={lRef} className="kps-l" aria-hidden="true">
          <span ref={lText} className="kps-l-n" />
          <span ref={lTag} className="kps-l-t" />
        </div>
        {/* XL */}
        <div ref={xRef} className="kps-x" aria-hidden="true">
          <span ref={xText} className="kps-x-n" />
          <span ref={xSubWrap} className="kps-x-subwrap">
            <span ref={xSub} className="kps-x-sub" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
});
