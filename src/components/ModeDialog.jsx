// ModeDialog.jsx
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './ModeDialog.css';
import ModeDialogBackground from './ModeDialogBackground';
import { MODES } from './modeDialogConfig';
import ConnectingContent from './ConnectingContent';
import PackPicker from './PackPicker';
import packs from '../data/packs';
import ModeExample from './ModeExample';

// Open/close feel (fix/dialog-quality item 2): ONE transform+opacity transition on ONE element
// (the shell), 200ms ease-out. No FLIP morph, no separate content transition, no canvas repaint
// competing — the scrim fades separately (CSS, also 200ms) and nothing else animates.
const OPEN_MS = 200;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const OPEN_TRANSITION = `transform ${OPEN_MS}ms ${EASE}, opacity ${OPEN_MS}ms ${EASE}`;

// game.id -> animated-mode key (the prototype's MODES config keys).
const MODE_KEY = {
  'word-bomb': 'bomb',
  'category-blitz': 'blitz',
  chain: 'chain',
  fuse: 'fuse',
};

function prefersReduced() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Darken a #rrggbb hex toward black by `f` (0..1) — used for the colored CTA
// outline (DESIGN: outline is a darker shade of the fill, not black).
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * A mode card expanded into a centered dialog. It fades + scales in as one element
 * (200ms, item 2); `sourceEl` is unused now (the old card→dialog FLIP morph is gone).
 * CREATE/JOIN call back into App's existing room/join flow via onCreate/onJoin. Behind the
 * content sits a STATIC per-mode background (ModeDialogBackground — no canvas, no rAF).
 */
export default function ModeDialog({ game, sourceEl, onClose, onCreate, onJoin, onPlay, connecting, coldStart, blitzPacks, onToggleBlitzPack, onSetAllBlitzPacks }) {
  const shellRef = useRef(null);
  const scrimRef = useRef(null);
  const closingRef = useRef(false);

  const modeKey = MODE_KEY[game.id] || 'bomb';
  const mode = MODES[modeKey];
  // SOLO variant (CHAIN / FUSE): one PLAY button + a per-word wins line, instead of
  // CREATE/JOIN. Driven by `onPlay` being wired AND the mode being flagged solo — the
  // unlocked sibling of LockedPreviewDialog. Everything else (morph, bg, layout) is shared.
  const isSolo = !!onPlay && !!mode.solo;

  // OPEN: fade + gentle scale-up the shell as ONE element (transform+opacity, 200ms). No FLIP
  // morph, no content stagger, no canvas repaint. `sourceEl` is unused now (the card→dialog
  // morph is gone), kept only for call-site compatibility. Reduced motion drops the scale.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;
    const reduce = prefersReduced();
    shell.style.opacity = '0';
    shell.style.transform = reduce ? 'none' : 'scale(0.96)';
    const raf = requestAnimationFrame(() => {
      shell.style.transition = reduce ? `opacity ${OPEN_MS}ms ${EASE}` : OPEN_TRANSITION;
      shell.style.opacity = '1';
      shell.style.transform = 'scale(1)';
    });
    const scrim = scrimRef.current;
    const scrimRaf = requestAnimationFrame(() => scrim && scrim.classList.add('is-in'));
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(scrimRaf);
    };
  }, []);

  // CLOSE: fade + scale the shell back out over the same 200ms, then unmount.
  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const shell = shellRef.current;
    const scrim = scrimRef.current;
    if (scrim) scrim.classList.remove('is-in');
    const reduce = prefersReduced();
    if (shell) {
      shell.style.transition = reduce ? `opacity ${OPEN_MS}ms ${EASE}` : OPEN_TRANSITION;
      shell.style.opacity = '0';
      if (!reduce) shell.style.transform = 'scale(0.96)';
    }
    window.setTimeout(onClose, OPEN_MS);
  }, [onClose]);

  // Escape closes (matches the scrim click).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const accent = mode.accent;
  const overlay = (
    <div className="mode-dialog-overlay" role="presentation">
      <div className="mode-dialog-scrim" ref={scrimRef} onClick={handleClose} />
      <div
        className="mode-dialog-shell"
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${mode.t1} ${mode.t2} options`}
        style={{ borderColor: game.baseColor }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* STATIC background layer: a flat 2-stop mode gradient + one static SVG starburst +
            the bottom legibility gradient. No canvas, no rAF (item 1). */}
        <div
          className="mode-dialog-bg"
          aria-hidden="true"
          style={{ background: `linear-gradient(160deg, ${mode.bg[0]}, ${mode.bg[1]})` }}
        >
          <ModeDialogBackground mode={modeKey} />
          <div className="mode-dialog-legibility" />
        </div>

        <button
          className="mode-dialog-close"
          onClick={handleClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="mode-dialog-content">
          <div
            className="mode-dialog-chip"
            style={{ color: accent, borderColor: accent }}
          >
            {mode.chip}
          </div>

          <div className="mode-dialog-lower">
            {modeKey === 'blitz' && (
              <div className="mode-dialog-ai-badge">
                <span className="mode-dialog-ai-badge-ai">AI</span>
                <span className="mode-dialog-ai-badge-judged">JUDGED</span>
              </div>
            )}
            <div className="mode-dialog-title">
              {isSolo ? (
                <span className="mode-dialog-title-w2" style={{ color: accent }}>
                  {mode.name}
                </span>
              ) : (
                <>
                  <span className="mode-dialog-title-w1">{mode.t1}</span>{' '}
                  <span className="mode-dialog-title-w2" style={{ color: accent }}>
                    {mode.t2}
                  </span>
                </>
              )}
            </div>
            <div className="mode-dialog-liner">{mode.liner}</div>
            {/* Real worked example (item 2): the actual mechanic shown, plus the per-word wins
                rate and typical round length. Replaces the old prose "HOW IT WORKS" blurb. */}
            <ModeExample mode={game.id} accent={accent} />

            {modeKey === 'blitz' && (
              <PackPicker
                packs={packs}
                selected={blitzPacks}
                onToggle={onToggleBlitzPack}
                onSetAll={onSetAllBlitzPacks}
              />
            )}

            {/* SOLO (CHAIN/FUSE): a single PLAY button (the wins rate now lives in the example
                block above). */}
            {isSolo ? (
              <div className="mode-dialog-actions">
                <button
                  className="mode-dialog-btn mode-dialog-btn-create"
                  style={{ background: accent, borderColor: darken(accent, 0.45) }}
                  onClick={onPlay}
                >
                  PLAY
                </button>
              </div>
            ) : (
              /* CREATE/JOIN show the shared CONNECTING… / WAKING THE SERVER…
                 feedback IN PLACE of their label while their action is pending —
                 inside the dialog, above ModeDialog's own scrim (the Homepage
                 bottom-bar indicator would be hidden behind that scrim). Both are
                 disabled while EITHER is pending so a second tap can't double-fire. */
              <div className="mode-dialog-actions">
                <button
                  className="mode-dialog-btn mode-dialog-btn-create"
                  style={{ background: accent, borderColor: darken(accent, 0.45) }}
                  onClick={onCreate}
                  disabled={!!connecting}
                >
                  {connecting === 'create' ? <ConnectingContent cold={coldStart} /> : mode.create}
                </button>
                <button
                  className="mode-dialog-btn mode-dialog-btn-join"
                  onClick={onJoin}
                  disabled={!!connecting}
                >
                  {connecting === 'join' ? <ConnectingContent cold={coldStart} /> : 'JOIN WITH CODE'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
