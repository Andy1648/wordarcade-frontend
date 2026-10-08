// AudioControls.jsx — the ONE corner sound control (Job 11). A single 🔊 button in the bottom-right
// corner (the only fixed audio element now) that opens a small popover holding every sound switch —
// MUSIC (♫), KEYSTROKE (⌨), EVENTS (🔊), REDUCE MOTION — plus the master VOLUME slider.
//
// Why one button: the three used to be three SEPARATE position:fixed buttons floating side by side,
// which at 360px reached far enough left to sit on top of the menu's CREDITS footer link (a fixed
// element with no layout relationship to the page will collide with whatever is under it). Folding
// them behind one speaker button keeps a single, narrow corner control that never overlaps the
// footer, and gives one place for every sound switch.
//
// THE PANEL IS LAZY (P9d payload ratchet): only the BUTTON ships in the initial load. The rows it opens — the live
// panel, or season 2's five-row SETTINGS sheet — live in AudioPanel.jsx, fetched the first time a pointer or focus
// reaches the button (and on the click), so the panel is ready by the time it opens. The button's struck-through
// "all quiet" glyph still reads the live sound state here (the panel reports every switch it flips).
import { lazy, Suspense, useState } from 'react';
import './AudioControls.css';
import { isEventSoundsEnabled } from '../audio/gameSounds';
import { isClackEnabled } from '../progress/clack';

const loadPanel = () => import('./AudioPanel.jsx');
const AudioPanel = lazy(loadPanel);
const warm = () => { loadPanel().catch(() => {}); };

// `variant` — 'fixed' (default) is the app-wide bottom-right corner control; 'inline' drops the
// fixed positioning so it can sit INSIDE the menu's corner-nav cluster (fix/visual-real item 4),
// with its popover opening DOWNWARD from the button instead of up.
// `sfxMuted` / `onToggleSfx` — the GAME SFX engine's master mute (SoundContext, owned by App). Omit the handler and
// the row is not rendered (the menu and every non-game screen have no SFX engine mounted).
export default function AudioControls({
  accent = '#2EFFE0', musicMuted = false, onToggleMusic, variant = 'fixed',
  sfxMuted = false, onToggleSfx = null,
}) {
  const [open, setOpen] = useState(false);
  const [snd, setSnd] = useState(() => ({ events: isEventSoundsEnabled(), clack: isClackEnabled() }));
  // The corner glyph reflects the master state: struck-through when EVERY sound is off/muted, so
  // "all quiet" reads at a glance without opening the panel.
  const allOff = musicMuted && !snd.events && !snd.clack && (!onToggleSfx || sfxMuted);

  return (
    <div className={`audio-ctrl${variant === 'inline' ? ' audio-ctrl--inline' : ''}`}>
      {open && (
        <Suspense fallback={null}>
          <AudioPanel
            accent={accent}
            musicMuted={musicMuted}
            onToggleMusic={onToggleMusic}
            sfxMuted={sfxMuted}
            onToggleSfx={onToggleSfx}
            onSound={setSnd}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
      <button
        type="button"
        className={`audio-btn${allOff ? ' off' : ''}`}
        style={variant === 'inline' ? undefined : { borderColor: accent, color: accent }}
        onClick={() => { warm(); setOpen((o) => !o); }}
        onPointerEnter={warm}
        onFocus={warm}
        title="Settings"
        aria-label="Settings — sound, music, rank plate, save progress"
        aria-expanded={open}
      >
        {/* SETTINGS (Andy oct8: "maybe have a settings icon"): a cog — the panel holds sound + music + motion +
            number style + RANK PLATE + SAVE PROGRESS. A struck "all quiet" state keeps its own mark. */}
        <svg className="audio-cog" viewBox="0 0 32 32" width="24" height="24" aria-hidden="true">
          <path d="M13.2 2.8h5.6l.9 3.7 2.6 1.1 3.3-2 4 4-2 3.3 1.1 2.6 3.7.9v5.6l-3.7.9-1.1 2.6 2 3.3-4 4-3.3-2-2.6 1.1-.9 3.7h-5.6l-.9-3.7-2.6-1.1-3.3 2-4-4 2-3.3-1.1-2.6-3.7-.9v-5.6l3.7-.9 1.1-2.6-2-3.3 4-4 3.3 2 2.6-1.1z"
            fill="currentColor" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="5" fill="#1a0b2e" stroke="#000" strokeWidth="2" />
          <circle cx="13.4" cy="9.4" r="1.4" fill="#fff" opacity="0.85" />
        </svg>
        {allOff ? <span className="audio-muted-mark" aria-hidden="true">✕</span> : null}
      </button>
    </div>
  );
}
