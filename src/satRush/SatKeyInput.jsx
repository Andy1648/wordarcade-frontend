// SatKeyInput.jsx — THE TYPING AFFORDANCE. One <input>, so a touch device can play.
//
// WHAT WAS BROKEN: SAT RUSH was driven entirely by window `keydown`. On a phone there is no
// physical keyboard and nothing on the board summoned a soft one, so a visitor who followed
// /sat-rush/play got a fully-rendered, fully-correct board they could not type a single letter
// into. CHAIN and FUSE each have a real <input>, which is why the same deep link "worked" for
// them and not for this mode — the board was never the problem; the keyboard was.
//
// WHY A HIDDEN INPUT IS SAFE HERE (the old objection, answered): the worry was that a native
// field buffers, autocorrects and composes, which fights a slot model that must REJECT a key
// without advancing. That is true of a field you READ. This one is never read: every
// `beforeinput` is cancelled, the value is forced back to '' on every event, and the character is
// handed to the game's own key path (`typeKey`) which alone decides accept/reject. The field
// holds no state, so there is no buffer to disagree with the slots. Autocorrect, autocapitalise,
// spellcheck and autocomplete are all off, and composition input (an IME candidate window) is
// ignored rather than guessed at — SAT RUSH's corpus is a-z only.
//
// KEEPING THE KEYBOARD: a browser only opens the soft keyboard from a real user gesture, so
// focus is taken on pointerdown anywhere on the board (not on the exit button or the dev tuner,
// which need their own focus). The hint under the poster is the visible half of that contract and
// only exists where there is no hardware keyboard.
import { useEffect, useRef, useState } from 'react';

// A coarse pointer with no hover is the "no hardware keyboard" signal. Resolved once per mount
// (not per frame) — this drives a hint line, not layout, so it need not track a docked keyboard.
function isTouchOnly() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}

// Controls that own their own focus — tapping these must not steal it back to the field.
const FOCUS_OWNERS = 'button, a, input, textarea, select, [role="button"], [contenteditable]';

export default function SatKeyInput({ active, typeKey }) {
  const ref = useRef(null);
  const [touch] = useState(isTouchOnly);
  const [focused, setFocused] = useState(false);

  // Take focus from any tap on the board, INSIDE the gesture — a browser only opens the soft
  // keyboard for a focus it can attribute to the user.
  //
  // THREE listeners, because one is not enough: focusing on `pointerdown` is the earliest (and the
  // only one a touch keyboard reliably honours), but `mousedown`'s DEFAULT ACTION then moves focus
  // to whatever was clicked — measured: focusin on the field, then mousedown, then focusout, and
  // the field ends up blurred. So mousedown's default is cancelled for taps that are not on a
  // control of their own, and `click` re-takes focus as a belt-and-braces for any browser that
  // ordered those differently.
  useEffect(() => {
    if (!active) return undefined;
    const wantsFocus = (e) => {
      const t = e.target;
      return !(t && t.closest && t.closest(FOCUS_OWNERS));
    };
    const take = (e) => {
      if (!wantsFocus(e)) return;
      const el = ref.current;
      if (!el || document.activeElement === el) return;
      el.focus({ preventScroll: true });
    };
    // Cancelling mousedown's default suppresses the focus change (and the text selection) only;
    // the click event still fires, so nothing else on the board loses a handler.
    const holdFocus = (e) => {
      if (wantsFocus(e)) e.preventDefault();
    };
    document.addEventListener('pointerdown', take);
    document.addEventListener('mousedown', holdFocus);
    document.addEventListener('click', take);
    return () => {
      document.removeEventListener('pointerdown', take);
      document.removeEventListener('mousedown', holdFocus);
      document.removeEventListener('click', take);
    };
  }, [active]);

  // Blur the field when the run stops, so the keyboard does not sit over the results page.
  useEffect(() => {
    if (active) return;
    const el = ref.current;
    if (el && document.activeElement === el) el.blur();
  }, [active]);

  // NATIVE listeners, not React's onBeforeInput. React 18's synthetic `onBeforeInput` is the
  // legacy textInput event and carries no `inputType`, so it cannot tell an inserted letter from
  // a backspace — the one distinction this bridge exists to make.
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return undefined;

    const onBeforeInput = (e) => {
      const type = e.inputType;
      if (type === 'insertText' || type === 'insertFromPaste') {
        e.preventDefault();
        // A soft keyboard can deliver more than one character in one event (a paste, or a word
        // prediction). Feed them in order through the one key path; the slot model rejects
        // whatever does not belong without advancing, exactly as it would from a keyboard.
        for (const ch of e.data || '') typeKey(ch);
        return;
      }
      if (type && type.startsWith('deleteContent')) {
        e.preventDefault();
        typeKey('Backspace');
      }
      // insertCompositionText / anything else: ignored. The corpus is a-z; a composition
      // candidate is never a letter this mode can use, and guessing at one is how a buffer
      // desyncs the slots.
    };

    // THE FIELD IS WRITE-ONLY. If a browser ignored preventDefault above, the character landed in
    // the value instead — feed it and clear, so the two paths can never both count it (after a
    // successful preventDefault the value is still '' and this does nothing).
    const onInput = () => {
      const v = el.value;
      if (!v) return;
      el.value = '';
      for (const ch of v) typeKey(ch);
    };

    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('input', onInput);
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('input', onInput);
    };
  }, [active, typeKey]);

  if (!active) return null;

  return (
    <>
      <input
        ref={ref}
        className="sr-keyinput"
        type="text"
        defaultValue=""
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        inputMode="text"
        enterKeyHint="done"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Type the wanted word"
      />
      {touch && !focused && (
        <p className="sr-keyhint" onPointerDown={() => ref.current?.focus({ preventScroll: true })}>
          tap the poster to type
        </p>
      )}
    </>
  );
}
