// useGlobalButtonFeedback.js — the app-wide, document-delegated button feedback extracted from
// App.jsx (refactor/app-split-6). PURE refactor: the hover-blip listener + the press squash/tick
// listener, moved verbatim. Both are single delegated document listeners so every screen is covered
// with zero per-button wiring. Takes `sound` (for the hover blip). Ordering vs the app's other
// mount effects is irrelevant: these attach independent document listeners and read no shared state.
import { useEffect } from 'react';
import { squash, sfx } from '../juice';

export function useGlobalButtonFeedback(sound) {
  // Subtle hover blip on any real <button>, app-wide (Lobby / Room / game UI),
  // via one delegated listener so we don't touch every button. The Homepage game
  // cards are <div role="button">, so they're NOT matched here and keep their own
  // per-card hover. De-duped per element (no re-fire while moving within a button)
  // and time-debounced so sweeping the pointer across a row doesn't machine-gun.
  useEffect(() => {
    let lastBtn = null;
    let lastAt = 0;
    const onOver = (e) => {
      const btn = e.target.closest ? e.target.closest('button') : null;
      if (!btn || btn === lastBtn || btn.disabled) return;
      lastBtn = btn;
      const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (t - lastAt < 70) return; // debounce
      lastAt = t;
      sound.menuHover();
    };
    const onOut = (e) => {
      // Only re-arm once the pointer truly LEAVES the button (not when it crosses
      // between the button's own children), so a child boundary can't re-trigger.
      if (lastBtn && !(e.relatedTarget && lastBtn.contains(e.relatedTarget))) {
        lastBtn = null;
      }
    };
    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
    };
  }, [sound]);

  // ONE shared press-feedback handler for EVERY <button> in the app (menu, lobby,
  // game, results): a light squash + tick on press, matching the CREATE/JOIN proof.
  // Delegated at the document in the CAPTURE phase so it covers every screen with
  // zero per-button wiring and fires even if a handler stops propagation. Buttons
  // that run their own bespoke juice (CREATE/JOIN) opt out via [data-juice-self] so
  // they never double-fire. squash() + sfx() self-gate on reduced-motion + mute
  // inside the toolkit and neither blocks nor awaits, so the type loop is untouched.
  useEffect(() => {
    function onPointerDown(e) {
      const btn = e.target?.closest?.('button');
      if (!btn || btn.disabled) return;
      if (btn.hasAttribute('data-juice-self')) return; // owns its own juice
      squash(btn);
      sfx('tap');
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);
}
