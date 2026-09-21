// useMediaQuery.js — subscribe to a CSS media query from React.
//
// WHY A HOOK AND NOT JUST CSS: the phone menu (feat/mobile-first-screen) is a NODE-COUNT
// change, not only a visual one. `display:none` still mounts and lays out every hidden
// element — the five game cards alone are ~390 DOM nodes — so hiding them in CSS would
// leave the first screen exactly as heavy as it is today. Not RENDERING them is the win,
// and that decision has to reach JSX.
//
// The initial value is read synchronously in the useState initializer, so the very first
// render is already correct for the current width — there is no desktop-tree flash on a
// phone, and no phone-tree flash on a desktop.
import { useEffect, useState } from 'react';

function read(query) {
  try {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(query).matches;
  } catch {
    // matchMedia unavailable (very old browser / jsdom without a stub) — treat as "not
    // matching" so the component falls back to its full desktop tree rather than blanking.
    return false;
  }
}

/**
 * True while `query` matches. Re-renders on change (orientation flip, window resize,
 * devtools device toolbar). Never throws.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => read(query));

  useEffect(() => {
    let mql;
    try {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
      mql = window.matchMedia(query);
    } catch {
      return undefined;
    }
    // Re-sync on mount: the width can change between the initializer and the effect.
    setMatches(mql.matches);
    const onChange = (e) => setMatches(e.matches);
    // addEventListener is the modern API; addListener is the Safari <14 fallback.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
