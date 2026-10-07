// AudioControls.jsx — the ONE corner sound control (Job 11). A single 🔊 button in the bottom-right
// corner (the only fixed audio element now) that opens a small popover holding all three sound
// toggles — MUSIC (♫), KEYSTROKE (⌨), EVENTS (🔊) — plus the master VOLUME slider.
//
// Why one button: the three used to be three SEPARATE position:fixed buttons floating side by side,
// which at 360px reached far enough left to sit on top of the menu's CREDITS footer link (a fixed
// element with no layout relationship to the page will collide with whatever is under it). Folding
// them behind one speaker button keeps a single, narrow corner control that never overlaps the
// footer, and gives one place for every sound switch.
//
// Everything is OFF-by-default / persisted, and the AudioContext is only ever created or resumed
// INSIDE a user gesture (enable*/ensureCtx run from the toggle/slider handlers), so nothing plays
// before the user asks for it and OFF is genuinely silent.
import { lazy, Suspense, useId, useState } from 'react';
import { SEASON2 } from '../progress/season';
import './AudioControls.css';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { enableClack, disableClack, isClackEnabled } from '../progress/clack';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';
import { setReduceMotion } from '../lib/reduceMotion';
import { useReduceMotion } from '../lib/useReduceMotion';

// SEASON 2 (P9d): the popover is the v2 FIVE-ROW SETTINGS (SOUND · MUSIC · REDUCE MOTION · NUMBER STYLE · KEYBOARD
// SOUNDS). Lazy, and only fetched when a season-2 player opens it, so the live menu's payload is unchanged.
const SettingsPanel = lazy(() => import('./SettingsPanel.jsx'));

// `variant` — 'fixed' (default) is the app-wide bottom-right corner control; 'inline' drops the
// fixed positioning so it can sit INSIDE the menu's corner-nav cluster (fix/visual-real item 4),
// with its popover opening DOWNWARD from the button instead of up.
// `sfxMuted` / `onToggleSfx` — the GAME SFX engine's master mute (SoundContext, owned by App).
// It used to live in a SEPARATE speaker button in the Word Bomb header, which meant two speaker
// buttons on one screen controlling two different sound systems, and this panel's own comment
// claiming to be "the ONE corner sound control" while it wasn't. Folded in here; the header now
// hosts this control instead of a twin. Omit the handler and the row is not rendered (the menu and
// every non-game screen have no SFX engine mounted).
export default function AudioControls({
  accent = '#2EFFE0', musicMuted = false, onToggleMusic, variant = 'fixed',
  sfxMuted = false, onToggleSfx = null,
}) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(() => isEventSoundsEnabled());
  const [clack, setClack] = useState(() => isClackEnabled());
  const [vol, setVol] = useState(() => getMasterVolume());
  // REDUCE MOTION lives in this panel too: it is the app's one settings cluster (CLAUDE.md NO ORPHAN
  // FIXED UI). OFF by default and NOT the OS setting — managed school Chromebooks force
  // prefers-reduced-motion: reduce. Takes effect live (src/lib/reduceMotion.js flips <html data-reduce-motion>).
  const reduceOn = useReduceMotion();
  const motionLabelId = useId();

  const toggleEvents = () => {
    if (events) { disableEventSounds(); setEvents(false); }
    else { enableEventSounds(); setEvents(true); } // creates/resumes the shared AudioContext in-gesture
  };
  const toggleClack = () => {
    if (clack) { disableClack(); setClack(false); }
    else { enableClack(); setClack(true); } // creates/resumes the AudioContext in-gesture
  };
  const onVol = (e) => {
    const v = Number(e.target.value) / 100;
    ensureCtx(); // user gesture — safe to warm the context so the slider is audible live
    setMasterVolume(v);
    setVol(v);
  };

  // The corner glyph reflects the master state: struck-through when EVERY sound is off/muted, so
  // "all quiet" reads at a glance without opening the panel.
  const allOff = musicMuted && !events && !clack && (!onToggleSfx || sfxMuted);

  const Toggle = ({ on, onClick, glyph, label }) => (
    <div className="audio-row">
      <span className="audio-row-label">{label}</span>
      <button
        type="button"
        className={`audio-toggle${on ? '' : ' off'}`}
        style={{ borderColor: accent, color: accent }}
        onClick={onClick}
        aria-pressed={on}
        aria-label={`${label} sound: ${on ? 'on' : 'off'}`}
      >
        {glyph}
      </button>
    </div>
  );

  return (
    <div className={`audio-ctrl${variant === 'inline' ? ' audio-ctrl--inline' : ''}`}>
      {/* SEASON 2: the five-row SETTINGS sheet (SettingsPanel.jsx — lazy, portalled, closes from here) */}
      {open && SEASON2 && (
        <Suspense fallback={null}>
          <SettingsPanel sheet musicMuted={musicMuted} onToggleMusic={onToggleMusic} sfxMuted={sfxMuted} onToggleSfx={onToggleSfx} onClose={() => setOpen(false)} />
        </Suspense>
      )}
      {open && !SEASON2 && (
        <div className="audio-panel" role="group" aria-label="Sound settings">
          <Toggle on={!musicMuted} onClick={onToggleMusic} glyph="♫" label="MUSIC" />
          {onToggleSfx && (
            <Toggle on={!sfxMuted} onClick={onToggleSfx} glyph="💥" label="GAME SFX" />
          )}
          <Toggle on={clack} onClick={toggleClack} glyph="⌨" label="KEYSTROKE" />
          <Toggle on={events} onClick={toggleEvents} glyph="🔊" label="EVENTS" />
          <div className="audio-row">
            <span className="audio-row-label" id={motionLabelId}>REDUCE MOTION</span>
            <button
              type="button"
              role="switch"
              aria-checked={reduceOn}
              aria-labelledby={motionLabelId}
              className={`audio-toggle audio-toggle--motion${reduceOn ? '' : ' off'}`}
              style={{ borderColor: accent, color: accent }}
              onClick={() => setReduceMotion(!reduceOn)}
            >
              ∿
            </button>
          </div>
          <div className="audio-row audio-row-vol">
            <span className="audio-row-label">VOLUME</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(vol * 100)}
              onChange={onVol}
              aria-label="Master volume"
              style={{ accentColor: accent }}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        className={`audio-btn${allOff ? ' off' : ''}`}
        style={variant === 'inline' ? undefined : { borderColor: accent, color: accent }}
        onClick={() => setOpen((o) => !o)}
        title="Sound settings"
        aria-label="Sound settings"
        aria-expanded={open}
      >
        🔊
      </button>
    </div>
  );
}
