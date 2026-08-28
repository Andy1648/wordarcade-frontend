// RarityFlash.jsx — shared RARITY (word-value) pop for the solo modes (SAT Rush, CHAIN, FUSE),
// which don't share Word Bomb/Blitz's hype-popup. A rarer accepted word flashes its tier label
// ("RARE ×2.5") in the tier colour, centred over the play area. COMMON stays silent.
//
// Re-key it at the callsite (`key={acceptCount}`) so a new accept REMOUNTS it and the one-shot
// animation replays. Purely decorative: position:fixed, pointer-events:none, aria-hidden, and a
// finite transform/opacity-only animation (animation budget). Renders nothing for COMMON/absent.
import { useState } from 'react';
import './RarityFlash.css';

export default function RarityFlash({ rarity }) {
  const [done, setDone] = useState(false);
  if (done || !rarity || !rarity.announce) return null;
  return (
    <div
      className="rarity-flash"
      style={{ color: rarity.color }}
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      {rarity.label}
    </div>
  );
}
