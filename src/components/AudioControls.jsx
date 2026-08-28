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
import { useState } from 'react';
import './AudioControls.css';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { enableClack, disableClack, isClackEnabled } from '../progress/clack';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';

export default function AudioControls({ accent = '#2EFFE0', musicMuted = false, onToggleMusic }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(() => isEventSoundsEnabled());
  const [clack, setClack] = useState(() => isClackEnabled());
  const [vol, setVol] = useState(() => getMasterVolume());

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
  const allOff = musicMuted && !events && !clack;

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
        title={`${label} sound: ${on ? 'on' : 'off'}`}
      >
        {glyph}
      </button>
    </div>
  );

  return (
    <div className="audio-ctrl">
      {open && (
        <div className="audio-panel" role="group" aria-label="Sound settings">
          <Toggle on={!musicMuted} onClick={onToggleMusic} glyph="♫" label="MUSIC" />
          <Toggle on={clack} onClick={toggleClack} glyph="⌨" label="KEYSTROKE" />
          <Toggle on={events} onClick={toggleEvents} glyph="🔊" label="EVENTS" />
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
        style={{ borderColor: accent, color: accent }}
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
