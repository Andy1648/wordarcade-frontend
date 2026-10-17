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
import { SEASON2 } from '../progress/season';
import './WinsCreditToast.css';

const MAX_ON_SCREEN = 3;
const HOLD_MS = 2600;
const UL_HOLD_MS = 3400;

// THE UNLISTED room announcement — "<NAME> FOUND AN UNLISTED GEAR". App's WS drain calls this for an
// `unlisted_found` frame (another player in my room found one). It rides this column for the same
// NO-ORPHAN reason as the wins rows, in every game mode and the room. Names the TIER only — the frame
// never carries which gear or how it was found. Not a wins popup, so the SEASON2 purge doesn't apply.
const ulSubs = new Set();
let ulSeq = 0;
export function announceUnlistedFind(name) {
  const who = String(name || 'SOMEONE').slice(0, 24);
  ulSeq += 1;
  const entry = { id: `ul-${ulSeq}`, unlisted: true, label: `${who} FOUND AN UNLISTED GEAR` };
  for (const fn of ulSubs) {
    try { fn(entry); } catch { /* ignore */ }
  }
}

export default function WinsCreditToast() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const off = subscribeWins((entry) => {
      // Per-word money is already on screen continuously in the pill; announcing it again per word
      // would be noise on top of the thing it duplicates.
      // P7 POPUP PURGE (SEASON2 only): no "claimed wins" / bonus toasts at all — a gain is motion on the pill, a claim
      // lives in ACHIEVEMENTS, and every credited win is still its own line on the run's receipt. Flag OFF: unchanged.
      if (SEASON2 || !entry || entry.kind !== 'bonus' || entry.amount <= 0) return;
      setItems((prev) => [...prev, entry].slice(-MAX_ON_SCREEN));
      const id = entry.id;
      setTimeout(() => setItems((prev) => prev.filter((e) => e.id !== id)), HOLD_MS);
    });
    const onFind = (entry) => {
      setItems((prev) => [...prev, entry].slice(-MAX_ON_SCREEN));
      setTimeout(() => setItems((prev) => prev.filter((e) => e.id !== entry.id)), UL_HOLD_MS);
    };
    ulSubs.add(onFind);
    return () => {
      off();
      ulSubs.delete(onFind);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="wct" aria-live="polite">
      {items.map((e) => e.unlisted ? (
        <div className="wct-row wct-row--ul" key={e.id}>
          <span className="wct-label" translate="no">{e.label}</span>
        </div>
      ) : (
        <div className="wct-row" key={e.id}>
          <span className="wct-label">{e.label}</span>
          <span className="wct-amt">+{formatNum(e.amount)}</span>
        </div>
      ))}
    </div>
  );
}
