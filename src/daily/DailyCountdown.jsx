// DailyCountdown.jsx — the live "NEXT DAILY IN HH:MM:SS" clock. This component OWNS the
// interval (the math lives in the pure countdown.js, unit-tested with no clock). It ticks
// once a second, and when the local day rolls over it fires onRollover so the menu can flip
// a locked daily back to playable without a page refresh. No animation (menu motion law).
import { useEffect, useRef, useState } from 'react';
import { msUntilLocalMidnight, formatCountdown } from './countdown.js';
import { localDateKey } from './dailySeed.js';

export default function DailyCountdown({ className = '', prefix = '', onRollover }) {
  const [label, setLabel] = useState(() => formatCountdown(msUntilLocalMidnight()));
  const dayRef = useRef(localDateKey());
  const rolloverRef = useRef(onRollover);
  rolloverRef.current = onRollover;

  useEffect(() => {
    // Tick every second. Kept off rAF on purpose: this is a 1Hz text update, not a
    // per-frame effect, and it must keep running while the tab is backgrounded so the
    // clock is correct the moment the player looks back.
    const id = setInterval(() => {
      setLabel(formatCountdown(msUntilLocalMidnight()));
      const today = localDateKey();
      if (today !== dayRef.current) {
        dayRef.current = today;
        rolloverRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={`daily-countdown${className ? ` ${className}` : ''}`} aria-live="off">
      {prefix}
      {label}
    </span>
  );
}
