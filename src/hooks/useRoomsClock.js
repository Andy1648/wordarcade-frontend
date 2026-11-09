// useRoomsClock.js — the clock a room list's STARTS IN countdowns read (roomList.rowAction). `receivedAt` is when this
// rooms array arrived (App builds a new one per public_rooms reply); `now` ticks once a second, and only while some
// lobby is counting down - a list with no countdown never re-renders on its own.
import { useEffect, useState } from 'react';

export default function useRoomsClock(rooms) {
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = Date.now();
    setReceivedAt(t);
    setNow(t);
  }, [rooms]);
  const ticking = Array.isArray(rooms) && rooms.some((r) => r && r.status !== 'playing' && Number.isFinite(r.startsInMs));
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  return { receivedAt, now };
}
