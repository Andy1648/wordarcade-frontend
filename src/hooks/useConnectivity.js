// useConnectivity.js — the online/offline state extracted from App.jsx (refactor/app-split-6).
// PURE refactor: moved verbatim. feat/offline: connectivity, so the multiplayer modes (Word Bomb /
// Category Blitz — which NEED the server) show a clear NEEDS INTERNET state instead of a silent spin,
// while CHAIN / FUSE / SAT RUSH (fully client-side, precached by the service worker) stay playable.
// Seeded from navigator.onLine and kept live via the online/offline events. No params; returns the
// single `offline` boolean the menu render reads.
import { useState, useEffect } from 'react';

export function useConnectivity() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return offline;
}
