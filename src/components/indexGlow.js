// indexGlow.js — how big the GearFx aura may be on an INDEX / EQUIP tile (Andy oct16: no aura cut off by the borders).
// The grid's scroller clips at its padding box, so every edge card's glow must fit in the room the layout leaves it
// (MarksIndex.css AURA ROOM). On a laptop that room is padding (0.9 → MYTHIC 38px, + its hover swell). On a phone the
// room is what's left beside two cards: 27px at 390, 24px at 360, 8px at 320 — 5px less in a narrow DESKTOP window,
// whose 10px scrollbar lane takes it — so the aura scales down to fit (MYTHIC/SECRET are the widest at 42 × scale).
// Read from matchMedia on mount and on a breakpoint change only — never per frame.
import { useEffect, useState } from 'react';

const STEPS = [
  ['(max-width: 340px)', 0.16], // 7–8px room → MYTHIC 7px
  ['(max-width: 375px)', 0.42], // 19–24px room (360 wide) → MYTHIC 18px
  ['(max-width: 560px)', 0.5], // 22–27px room → MYTHIC 21px
];
const DESKTOP = 0.9;

function current() {
  if (typeof window === 'undefined' || !window.matchMedia) return DESKTOP;
  for (const [q, s] of STEPS) if (window.matchMedia(q).matches) return s;
  return DESKTOP;
}

export function useIndexGlowScale() {
  const [scale, setScale] = useState(current);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mqs = STEPS.map(([q]) => window.matchMedia(q));
    const on = () => setScale(current());
    mqs.forEach((m) => m.addEventListener('change', on));
    return () => mqs.forEach((m) => m.removeEventListener('change', on));
  }, []);
  return scale;
}
