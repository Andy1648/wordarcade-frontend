// useModalFocus.js — THE MODAL CONTRACT, in one place.
//
// Anything that declares `aria-modal="true"` is promising a screen reader that the rest of the
// page does not exist while it is open. Six overlays made that promise. FIVE let Tab walk back
// out onto the page behind (everything but ModeDialog, which already had a trap); FOUR dropped
// focus on BODY when they closed (Stats and Shop are the two exceptions — App.jsx returns their
// focus via Homepage's `restoreFocus`). MarksPicker broke all four clauses at once:
//
//   MEASURED on the built bundle (1280x720, 12 Tab presses from open):
//     ModeDialog          0/12 tabs escaped   focus after close: BODY          (no return)
//     LockedPreviewDialog 11/12 tabs escaped  — tab 2 landed on the live menu
//     RankLadder           8/12 tabs escaped  focus after close: BODY
//     MarksPicker         10/12 tabs escaped  focus never entered; ESCAPE DID NOTHING
//     StatsScreen          2/12 tabs escaped  — onto the app-level audio button
//     ShopScreen           0/12 (it has >12 controls; it escapes on the wrap)
//
// So: Escape, focus-in, focus CONTAINMENT, and focus RETURN, from one hook, so the next overlay
// gets them by construction instead of by remembering.
//
// WHAT THIS DOES NOT DO: it does not make anything `inert`, and it does not hide the background
// from assistive tech beyond the `aria-modal` attribute the caller already sets. It contains the
// TAB ring; a screen reader's own virtual cursor is governed by `aria-modal`, which is the
// caller's job to declare (and to deserve).
import { useEffect, useRef } from 'react';

// Deliberately the same selector the ModeDialog trap already shipped with, so this is a
// generalisation of proven behaviour, not a new guess.
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusablesIn(node) {
  return Array.from(node.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null,
  );
}

/**
 * @param {object} ref            ref to the element carrying role="dialog" (must be tabIndex={-1})
 * @param {function} onEscape     called on Escape. Required — a modal with no Escape is the defect.
 * @param {boolean|function} restoreFocus
 *        true (or a function returning true, evaluated AT CLOSE) restores focus to whatever was
 *        focused when the modal opened. Pass a function when the dialog can close BY NAVIGATING
 *        AWAY (ModeDialog's CREATE/PLAY): restoring focus to the card you just left would steal it
 *        from the screen you just entered.
 */
export default function useModalFocus(ref, { onEscape, restoreFocus = false } = {}) {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;
  const restoreRef = useRef(restoreFocus);
  restoreRef.current = restoreFocus;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    // Whatever opened us. Captured BEFORE we move focus in.
    const invoker = document.activeElement;
    node.focus();

    // Capture phase on `document`: Escape has to work even when focus has not (yet) entered the
    // dialog, which is exactly the state MarksPicker shipped in.
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (escRef.current) escRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusablesIn(node);
      if (list.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (active === node || !node.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      const want = typeof restoreRef.current === 'function' ? restoreRef.current() : restoreRef.current;
      // `isConnected` is the guard that makes this safe on the navigate-away paths: if the menu
      // behind us has already unmounted, there is nothing to return to and we leave focus alone.
      if (want && invoker && invoker.isConnected && typeof invoker.focus === 'function') {
        invoker.focus({ preventScroll: true });
      }
    };
    // ref identity is stable for the life of the component; this is a mount/unmount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
