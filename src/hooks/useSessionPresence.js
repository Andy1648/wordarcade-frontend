// useSessionPresence.js — the last-seen presence stamps extracted from App.jsx (refactor/app-split-6).
// PURE refactor: moved verbatim. Session presence: refresh the last-seen stamp on load and again on
// pagehide/beforeunload, so the intro's 30-minute session boundary measures absence from the SITE,
// not time since the intro (a refresh after a long play session must not replay it). This runs AFTER
// SEEN_INTRO was read at module load, so stamping now never suppresses this load's own intro. No
// params, no return — a mount effect only.
import { useEffect } from 'react';
import { stampLastSeen } from '../visitHistory';

export function useSessionPresence() {
  useEffect(() => {
    stampLastSeen();
    const stamp = () => stampLastSeen();
    window.addEventListener('pagehide', stamp);
    window.addEventListener('beforeunload', stamp);
    return () => {
      window.removeEventListener('pagehide', stamp);
      window.removeEventListener('beforeunload', stamp);
    };
  }, []);
}
