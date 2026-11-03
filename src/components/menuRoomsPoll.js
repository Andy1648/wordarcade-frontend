// menuRoomsPoll.js — the ONLY eager part of the menu's OPEN ROOMS (payload ratchet): the poll that asks for the list.
// The panel / chip themselves (MenuRooms.jsx + its CSS) are a lazy chunk that Homepage mounts once the first
// public_rooms reply has landed, so a cold first paint never downloads them.
import { useEffect, useRef } from 'react';

export const MENU_ROOMS_POLL_MS = 8000;

/**
 * Poll the public-room list while the menu is on screen: one request on start, then every MENU_ROOMS_POLL_MS — only
 * while `live` (socket open + the list is shown + nothing covers the menu) AND the tab is visible. The callback is
 * read through a ref: App re-renders ~1-2x/s with a fresh closure, and keying the timer on it would reset it forever.
 * The request is the existing list_public_rooms on the ONE socket (useRoom.handleRefreshPublicRooms).
 */
export function useMenuRoomsPoll(onRefresh, live) {
  const ref = useRef(onRefresh);
  ref.current = onRefresh;
  useEffect(() => {
    if (!live) return undefined;
    let id = null;
    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
    const tick = () => { if (visible() && ref.current) ref.current(); };
    const start = () => {
      if (id != null || !visible()) return;
      tick();
      id = setInterval(tick, MENU_ROOMS_POLL_MS);
    };
    const stop = () => {
      if (id == null) return;
      clearInterval(id);
      id = null;
    };
    const onVis = () => (visible() ? start() : stop());
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [live]);
}
