// useClaims — the live pending-claims list (claims.js), for the REWARDS button, panel and popup.
import { useEffect, useState } from 'react';
import { listClaims, subscribeClaims } from '../progress/claims.js';

export function useClaims() {
  const [list, setList] = useState(() => listClaims());
  useEffect(() => {
    setList(listClaims()); // anything queued between render and subscribe
    const off = subscribeClaims(setList);
    const re = () => setList(listClaims());
    window.addEventListener('storage', re);
    return () => {
      off();
      window.removeEventListener('storage', re);
    };
  }, []);
  return list;
}
