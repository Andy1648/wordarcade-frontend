// useWinsBalance — the live spendable balance for any wins display (W, Andy oct2 22:28). One source:
// wins.js subscribeBalance, which fires on every saveWins (credit, claim, code, purchase, refund).
// A storage event from another tab re-reads it too.
import { useEffect, useState } from 'react';
import { getWins, subscribeBalance, WINS_KEY } from './wins.js';
import { s2Key } from './season.js';

export function useWinsBalance() {
  const [wins, setWins] = useState(() => getWins());
  useEffect(() => {
    setWins(getWins()); // anything that changed between the first render and this effect
    const off = subscribeBalance((v) => setWins(v));
    const onStorage = (e) => { if (!e || e.key === s2Key(WINS_KEY) || e.key == null) setWins(getWins()); };
    window.addEventListener('storage', onStorage);
    return () => { off(); window.removeEventListener('storage', onStorage); };
  }, []);
  return wins;
}
