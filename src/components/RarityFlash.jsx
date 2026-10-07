// RarityFlash.jsx — shared RARITY (word-value) pop for the solo modes (SAT Rush, CHAIN, FUSE),
// which don't share Word Bomb/Blitz's hype-popup. A rarer accepted word flashes its tier label
// ("RARE") in the tier colour, centred over the play area. COMMON stays silent. The BAND only, no ×N:
// rarity pays only in Word Bomb + Blitz (whose feed shows `label`, "RARE ×2.5"), never in these modes.
//
// Re-key it at the callsite (`key={acceptCount}`) so a new accept REMOUNTS it and the one-shot
// animation replays. Purely decorative: position:fixed, pointer-events:none, aria-hidden, and a
// finite transform/opacity-only animation (animation budget). Renders nothing for COMMON/absent.
// `edge` (SEASON 2 CHAIN): the same pop, pinned over the right-hand WINS / WORD column instead of the centre.
import { useState } from 'react';
import './RarityFlash.css';

export default function RarityFlash({ rarity, edge = false }) {
  const [done, setDone] = useState(false);
  if (done || !rarity || !rarity.announce) return null;
  return (
    <div
      className={`rarity-flash${edge ? ' rarity-flash--edge' : ''}`}
      style={{ color: rarity.color }}
      onAnimationEnd={() => setDone(true)}
      aria-hidden="true"
    >
      {rarity.band}
    </div>
  );
}
