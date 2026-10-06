// Season2Update.jsx — THE SEASON 2 "UPDATE" CARD (Andy oct6: no reset; claude/mockups/v2/Season2.dc.html restyled as
// UPDATE). LAZY (its own chunk): v3/season2Update.js mounts it ONCE for a converted season-1 save. A full-screen moment
// over the menu (never a centre popup): UPDATE slams in · YOUR PROGRESS IS KEPT · your old run R{n} → now R{≤10} · ★ ·
// POWER · what's new · what was kept · PLAY. No gems, no gift, no "starts fresh". Built from the v2 kit (KitIcon,
// KitButton). Every motion is a one-shot transform/opacity (no idle loop); REDUCE MOTION: everything sits at rest.
import { useEffect, useRef } from 'react';
import { KitIcon, KitButton } from './kit/index.js';
import { formatNum } from '../format.js';
import { useMomentHold } from '../lib/useMomentSlot';
import './Season2Update.css';

/** What's new in season 2 (progression v3) — the card's list. */
export const WHATS_NEW = [
  { icon: 'ascend', text: '★ STARS MULTIPLY XP AND WINS — ASCEND AT R10 FOR MORE' },
  { icon: 'power', text: 'POWER: WINS BUY IT, EVERY STEP ×1.65 XP' },
  { icon: 'rebirth', text: 'EVERY REBIRTH ×2 XP AND WINS' },
  { icon: 'gems', text: 'GEMS BUY THE REST — ROLL MARKS, STOCK, STYLES' },
];

export default function Season2Update({ plan, onClose }) {
  const btnRef = useRef(null);
  useMomentHold(true); // no queued menu moment starts under the card
  useEffect(() => {
    // the menu types on keystrokes: while the card is up, keys belong to it (Enter/Space still press its button)
    const stop = (e) => {
      if (e.target && e.target.closest && e.target.closest('.s2u')) return;
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', stop, true);
    if (btnRef.current && btnRef.current.focus) btnRef.current.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', stop, true);
  }, []);

  const { before, after } = plan;
  const moved = before.rebirths !== after.rebirths;
  return (
    <div className="s2u" role="dialog" aria-modal="true" aria-labelledby="s2u-title" data-testid="season2-update">
      <div className="s2u-band" aria-hidden="true" />
      <header className="s2u-head">
        <h1 id="s2u-title" className="s2u-title s2u-slam">UPDATE</h1>
        <p className="s2u-sub s2u-rise" style={{ '--s2u-d': '300ms' }}>SEASON 2 IS HERE · YOUR PROGRESS IS KEPT</p>
      </header>
      <div className="s2u-trade">
        <div className="s2u-col s2u-rise" style={{ '--s2u-d': '420ms' }}>
          <span className="s2u-cap">YOUR RUN</span>
          <span className="s2u-old" data-testid="season2-update-before">R{formatNum(before.rebirths)}</span>
        </div>
        <span className="s2u-arrow s2u-rise" style={{ '--s2u-d': '520ms' }} aria-hidden="true">
          <svg width="84" height="50" viewBox="0 0 70 44" focusable="false">
            <path d="M4 16 L44 16 L44 4 L66 22 L44 40 L44 28 L4 28 Z" fill="#2EFFE0" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="s2u-col s2u-rise" style={{ '--s2u-d': '620ms' }}>
          <span className="s2u-cap">{moved ? 'NOW' : 'KEPT'}</span>
          <div className="s2u-now">
            <span className="s2u-stat">
              <span className="s2u-num s2u-r" data-testid="season2-update-rebirths">R{formatNum(after.rebirths)}</span>
            </span>
            <span className="s2u-stat">
              <KitIcon name="ascend" size={44} />
              <span className="s2u-num s2u-star" data-testid="season2-update-stars">★{formatNum(after.stars)}</span>
            </span>
            <span className="s2u-stat">
              <KitIcon name="power" size={44} />
              <span className="s2u-num s2u-pow" data-testid="season2-update-power">P{formatNum(after.power)}</span>
            </span>
          </div>
          <span className="s2u-key">{moved ? `REBIRTHS ABOVE 10 → ★ · ` : ''}KEY TIER {formatNum(before.keyTier)} → POWER {formatNum(after.power)}</span>
        </div>
      </div>
      <ul className="s2u-new s2u-rise" style={{ '--s2u-d': '720ms' }} aria-label="What's new">
        {WHATS_NEW.map((x) => (
          <li key={x.icon}>
            <KitIcon name={x.icon} size={26} />
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
      <div className="s2u-foot">
        <p className="s2u-kept" data-testid="season2-update-kept">KEPT: LV {formatNum(after.level)} · WINS · GEMS · MARKS · ACHIEVEMENTS</p>
        <KitButton ref={btnRef} tone="yellow" label="PLAY" labelSize={38} width={360} onClick={onClose} data-testid="season2-update-play" />
      </div>
    </div>
  );
}
