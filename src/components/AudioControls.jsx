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
import BoostDock from '../frenzy/LazyBoostDock';

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
      {/* the bottom-right BOOST timers ride THIS cluster (Andy oct8) — never their own fixed element */}
      {variant !== 'inline' && !open && <BoostDock />}
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
        title="Sound settings"
        aria-label="Sound settings"
        aria-expanded={open}
      >
        🔊
      </button>
    </div>
  );
}
