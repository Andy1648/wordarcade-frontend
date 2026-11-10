// tapMode.js — is this a TAP device? (feat/sat-tap)
//
// Andy: "i think SAT rush doesnt need typing just tapping the right answer is enough". On a phone
// the soft keyboard covered half the poster, so a touch device answers by TAPPING a choice and no
// text field is ever mounted (no field = the keyboard can never open). A desktop keeps typing as the
// default, with the same choices clickable / on keys 1-N.
//
// The signal is the same one SatKeyInput always used for "no hardware keyboard": a coarse primary
// pointer with no hover. Resolved once per hook mount — the answer mode is fixed for a run.
// `?tap=1` / `?tap=0` force it either way (QA on a desktop browser, or a tablet with a keyboard).
export function detectTapMode() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('tap');
    if (q === '1') return true;
    if (q === '0') return false;
  } catch {
    /* no URL — fall through to the media query */
  }
  return isTouchOnly();
}

export function isTouchOnly() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}
