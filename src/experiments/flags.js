// flags.js — PHASE 7 experiments, all OFF unless a URL flag turns them on.
//
// These are PROTOTYPES for Andy to look at, not features. They live behind URL flags
// rather than on separate branches for one reason: a side-by-side screenshot of two
// variants is only honest if both come out of the SAME build. Two branches means two
// builds, and any other drift between them (a font that loaded on one run, a card that
// fit differently) shows up in the comparison as if it were the thing being judged.
//
//   ?x7a=1  Word Bomb danger escalation - the whole board's value band darkens and the
//           accent creeps yellow -> red as the fuse burns, instead of only the bomb.
//   ?x7b=1  Chromatic Bungee lockup for the menu wordmark, built from Bungee's shipped
//           Shade / regular / Inline / Outline layers, vs today's flat pink.
//   ?x7c=1  Per-mode background motif - one huge low-contrast silhouette behind each
//           gameplay screen at 6-10%.
//
// Nothing here is referenced when the flag is absent, so the default build is
// byte-identical in behaviour to the branch this sits on.
export function xFlag(name) {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get(name) === '1';
  } catch {
    return false; // a malformed query string is just "no experiment"
  }
}

// Some prototypes have more than two states, so they read a VALUE rather than a boolean.
// Returns undefined when absent, so it can be spread straight onto a data-* attribute
// without painting an empty one.
export function xParam(name) {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get(name) || undefined;
  } catch {
    return undefined;
  }
}
