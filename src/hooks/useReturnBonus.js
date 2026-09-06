// useReturnBonus.js — the RETURN BONUS claim extracted from App.jsx (refactor/app-split-6).
// PURE refactor: moved verbatim. Claim once on mount using the last-seen time captured at MODULE
// LOAD (passed in as `lastSeenAtLoad` so the timing is unchanged — it must be read before the
// session-presence effect re-stamps last-seen, otherwise "how long were you away" reads ~0). The
// wins are granted here (returned after >=6h, at most once/calendar day); the returned card is shown
// only on the home menu by the caller (a deep-link into a game doesn't overlay the return card).
import { useState, useEffect } from 'react';
import { claimReturnBonus } from '../progress/returnBonus';

export function useReturnBonus(lastSeenAtLoad) {
  const [returnCard, setReturnCard] = useState(null);
  useEffect(() => {
    const b = claimReturnBonus(lastSeenAtLoad);
    if (b) setReturnCard(b);
    // Fires once on mount; lastSeenAtLoad is a module-load constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { returnCard, setReturnCard };
}
