// RebirthReadyButton — "REBIRTH READY → ×5 FOREVER" (Andy oct3). The BIG primary action on every
// round-end card and on the menu, shown only while the player's level is at/past the rebirth gate.
//
// One tap: arm the one-shot rebirth intent (progress/rebirthNow.js), then call `onGo` — the host
// screen's EXISTING way to the menu (solo onExit, the room's leave path, or the menu's own REBIRTH
// handler). The menu / ShopScreen pick the intent up and run the rebirth + ceremony with no confirm.
//
// Motion: ONE finite attention pop on appear (transform/opacity, 360ms) — no infinite animation.
// Reduced motion shows it static. Renders nothing when the gate is not reached.
import { useEffect, useState } from 'react';
import { isRebirthReadyNow, requestRebirthNow, REBIRTH_READY_COPY } from '../progress/rebirthNow';
import { onMidGameLevelUp } from '../progress/levelUpSignal';
import './RebirthReadyButton.css';

/** Live "can rebirth now": read on every render (one storage read), re-checked on a mid-game level-up. */
export function useRebirthReady() {
  const [, bump] = useState(0);
  useEffect(() => onMidGameLevelUp(() => bump((n) => n + 1)), []);
  return isRebirthReadyNow();
}

export default function RebirthReadyButton({ onGo, className = '', ready: readyProp }) {
  const live = useRebirthReady();
  const ready = readyProp === undefined ? live : !!readyProp;
  if (!ready || typeof onGo !== 'function') return null;
  const go = () => {
    requestRebirthNow();
    onGo();
  };
  return (
    <button
      type="button"
      className={`rr-ready-btn${className ? ` ${className}` : ''}`}
      onClick={go}
      data-rr-ready="1"
    >
      {REBIRTH_READY_COPY}
    </button>
  );
}
