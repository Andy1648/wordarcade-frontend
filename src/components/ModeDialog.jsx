// ModeDialog.jsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ModeDialog.css';

// Morph timing/feel. The dialog grows from the clicked card to a centered panel
// over MORPH_MS with a snappy ease-out; the body fades/pops in CONTENT_DELAY into
// the morph so text never shows squashed mid-grow.
const MORPH_MS = 400;
const CONTENT_DELAY = 240;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const PANEL_BG = '#1a0b2e';
const TRANSITION = `transform ${MORPH_MS}ms ${EASE}, border-radius ${MORPH_MS}ms ${EASE}, background-color ${MORPH_MS}ms ease`;

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * A mode card expanded into a centered dialog via a hand-rolled FLIP morph (no
 * animation library). `sourceEl` is the clicked .game-card DOM node, measured
 * live with getBoundingClientRect so the morph starts (and, on close, returns)
 * exactly on the card even as it sways. The dialog is the intermediate step:
 * CREATE/JOIN call back into App's existing room/join flow via onCreate/onJoin.
 */
export default function ModeDialog({ game, sourceEl, onClose, onCreate, onJoin }) {
  const shellRef = useRef(null);
  const scrimRef = useRef(null);
  const closingRef = useRef(false);
  const [contentIn, setContentIn] = useState(false);

  // OPEN: position the (already final-sized) shell onto the card, then release to
  // its resting transform so it eases out into the dialog. Reads both rects before
  // any write. Under reduced motion this degrades to a plain cross-fade.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const reduce = prefersReduced();
    const first = sourceEl ? sourceEl.getBoundingClientRect() : null;

    let raf = 0;
    let contentTimer = 0;

    if (reduce || !first) {
      shell.style.opacity = '0';
      raf = requestAnimationFrame(() => {
        shell.style.transition = `opacity ${MORPH_MS}ms ease`;
        shell.style.opacity = '1';
      });
      contentTimer = window.setTimeout(() => setContentIn(true), 120);
    } else {
      // READ: the shell's resting (dialog) rect + the card rect.
      const last = shell.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      const sx = first.width / last.width;
      const sy = first.height / last.height;

      // WRITE: snap onto the card (no transition), wearing the card's fill/radius.
      shell.style.transition = 'none';
      shell.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      shell.style.borderRadius = '8px';
      shell.style.background = game.baseColor;

      // Next frame: release to identity so it morphs out to the dialog.
      raf = requestAnimationFrame(() => {
        shell.style.transition = TRANSITION;
        shell.style.transform = 'translate(0px, 0px) scale(1, 1)';
        shell.style.borderRadius = '16px';
        shell.style.background = PANEL_BG;
      });
      contentTimer = window.setTimeout(() => setContentIn(true), CONTENT_DELAY);
    }

    // Fade the scrim in a frame after mount.
    const scrim = scrimRef.current;
    const scrimRaf = requestAnimationFrame(() => scrim && scrim.classList.add('is-in'));

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrimRaf);
      window.clearTimeout(contentTimer);
    };
  }, [sourceEl, game.baseColor]);

  // CLOSE: reverse the morph back into the (re-measured) source card, then unmount.
  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setContentIn(false);

    const shell = shellRef.current;
    const scrim = scrimRef.current;
    if (scrim) scrim.classList.remove('is-in');

    const reduce = prefersReduced();
    const first = sourceEl ? sourceEl.getBoundingClientRect() : null;

    if (!shell || reduce || !first) {
      if (shell) {
        shell.style.transition = 'opacity 200ms ease';
        shell.style.opacity = '0';
      }
      window.setTimeout(onClose, 200);
      return;
    }

    const last = shell.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / last.width;
    const sy = first.height / last.height;

    shell.style.transition = TRANSITION;
    shell.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    shell.style.borderRadius = '8px';
    shell.style.background = game.baseColor;
    window.setTimeout(onClose, MORPH_MS);
  }, [sourceEl, game.baseColor, onClose]);

  // Escape closes (matches the scrim click).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const overlay = (
    <div className="mode-dialog-overlay" role="presentation">
      <div className="mode-dialog-scrim" ref={scrimRef} onClick={handleClose} />
      <div
        className="mode-dialog-shell"
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${game.name.replace('\n', ' ')} options`}
        style={{ borderColor: game.baseColor }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={`mode-dialog-close${contentIn ? ' is-in' : ''}`}
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>
        <div className={`mode-dialog-content${contentIn ? ' is-in' : ''}`}>
          <div className="mode-dialog-name" style={{ color: game.baseColor }}>
            {game.name}
          </div>
          <div className="mode-dialog-desc">{game.description}</div>
          <div className="mode-dialog-actions">
            <button
              className="mode-dialog-btn mode-dialog-btn-create"
              onClick={onCreate}
            >
              CREATE ROOM
            </button>
            <button
              className="mode-dialog-btn mode-dialog-btn-join"
              onClick={onJoin}
            >
              JOIN ROOM
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
