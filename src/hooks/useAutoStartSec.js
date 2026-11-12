// useAutoStartSec.js — the AUTO-START countdown every public lobby draws (Andy nov12: public rooms "must start after like
// + 5 sec (for every player joining) after the first"). THE SERVER OWNS THE CLOCK: room_update.autoStartInMs is re-sent
// with every roster change (a join adds 5 s); this only counts it down once a second while it runs. Null when the room
// is not counting (one player, a private room, a live game). No client ever starts a game from it.
import { useEffect, useState } from 'react';

export default function useAutoStartSec(room) {
  const autoMs = room && Number.isFinite(room.autoStartInMs) ? room.autoStartInMs : null;
  const [autoAt, setAutoAt] = useState(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (autoMs == null) { setAutoAt(null); return undefined; }
    const t = Date.now();
    setAutoAt(t + autoMs);
    setNow(t);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [room, autoMs]);
  return autoAt == null ? null : Math.max(0, Math.ceil((autoAt - now) / 1000));
}
