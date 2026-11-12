// useFrVoice.js — does this device have a French voice? (the 🔊 shows only when it does). Voice lists load
// late in Chrome, so this re-reads on every voiceschanged; it never throws and is false on the server.
import { useEffect, useState } from 'react';
import { hasFrVoice, onVoicesChange } from './speak';

export function useFrVoice(enabled = true) {
  const [ok, setOk] = useState(() => (enabled ? hasFrVoice() : false));
  useEffect(() => {
    if (!enabled) return undefined;
    setOk(hasFrVoice());
    return onVoicesChange(() => setOk(hasFrVoice()));
  }, [enabled]);
  return enabled && ok;
}
