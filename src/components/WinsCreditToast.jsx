// WinsCreditToast.jsx — EVERY WIN THAT IS NOT A WORD, SAID OUT LOUD, WHEN IT LANDS.
//
// ANDY: "Every single win he earns, no random hidden wins." / "I be here getting like 800 but it
// gives like over 2k — idk where the thing comes from."
//
// The per-word money always had a voice (the +N WINS pill, then WINS EARNED). The BONUS money did
// not: achievements chimed without saying what or how much, and collection milestones — 5,000 wins
// at the 100th distinct word, rebirth-scaled — said nothing at all. Measured on a 20-word run:
// balance +20,010, card +15,010.
//
// So this listens to the wins ledger (progress/wins.js `subscribeWins`) and announces every
// `kind: 'bonus'` credit as it happens, with its label. It is the moment-of-credit half; the
// end-of-run half is the named lines in WinsEarnedTotal. Both read the same ledger, so they cannot
// disagree with each other or with the balance.
//
// It JOINS the existing top-right wins column (.wins-hud / .wpm-hud) rather than mounting at its
// own coordinates — CLAUDE.md NO ORPHAN FIXED UI. It is a transient, pointer-events:none, and
// nothing it does can block play.
//
// MOTION: one finite transform/opacity entry per toast, no loop at rest, and a pooled cap of three
// on screen so a burst of simultaneous achievements cannot spawn unbounded nodes.
import { useEffect, useState } from 'react';
import { subscribeWins } from '../progress/wins';
import { formatNum } from '../format';
import './WinsCreditToast.css';

const MAX_ON_SCREEN = 3;
const HOLD_MS = 2600;

export default function WinsCreditToast() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const off = subscribeWins((entry) => {
      // Per-word money is already on screen continuously in the pill; announcing it again per word
      // would be noise on top of the thing it duplicates.
      if (!entry || entry.kind !== 'bonus' || entry.amount <= 0) return;
      setItems((prev) => [...prev, entry].slice(-MAX_ON_SCREEN));
      const id = entry.id;
      setTimeout(() => setItems((prev) => prev.filter((e) => e.id !== id)), HOLD_MS);
    });
    return off;
  }, []);

  if (!items.length) return null;
  return (
    <div className="wct" aria-live="polite">
      {items.map((e) => (
        <div className="wct-row" key={e.id}>
          <span className="wct-label">{e.label}</span>
          <span className="wct-amt">+{formatNum(e.amount)}</span>
        </div>
      ))}
    </div>
  );
}
