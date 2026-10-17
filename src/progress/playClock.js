// playClock.js — TIME PLAYED (Andy oct17: the profile shows "the most basic and important user stats (like time
// played)"). Counts only while a GAME screen is mounted AND the tab is visible — never menu idling. One start stamp,
// flushed to storage every 30 s, on hide and on unmount: no per-frame work, one tiny write at most every 30 s.
// Stored as whole seconds at taw.s2.playsec (a season-2 progress key, so the save backup / cloud save carry it).
import { useEffect } from 'react';

export const PLAY_KEY = 'taw.s2.playsec';
const FLUSH_MS = 30_000;
const CAP_S = 6 * 3600; // one flush can never add more than a session's worth (a laptop asleep on a game screen)

export function readPlaySec() {
  try { const n = Math.floor(Number(localStorage.getItem(PLAY_KEY))); return Number.isFinite(n) && n > 0 ? n : 0; } catch { return 0; }
}
export function addPlaySec(s) {
  const add = Math.min(CAP_S, Math.floor(s));
  if (!(add > 0)) return;
  try { localStorage.setItem(PLAY_KEY, String(readPlaySec() + add)); } catch { /* blocked storage */ }
}
/** "3h 12m" / "12m" / "40s" — the profile's TIME PLAYED. */
export function formatPlayTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h.toLocaleString('en-US')}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Mount on a game screen: counts visible time while it is up. */
export function usePlayClock() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    let since = document.visibilityState === 'hidden' ? 0 : Date.now();
    const flush = () => {
      if (!since) return;
      const now = Date.now();
      addPlaySec((now - since) / 1000);
      since = now;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') { flush(); since = 0; } else if (!since) since = Date.now();
    };
    const t = setInterval(flush, FLUSH_MS);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); flush(); };
  }, []);
}
