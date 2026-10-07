// AudioPanel.jsx — what the corner sound control (AudioControls) OPENS. Lazy (its own chunk), so the initial load ships
// only the button. Two bodies:
//   live      the MUSIC (♫) · GAME SFX (💥, in a game) · KEYSTROKE (⌨) · EVENTS (🔊) toggles, REDUCE MOTION, VOLUME;
//   SEASON 2  the five-row SETTINGS sheet (SettingsPanel: SOUND · MUSIC · REDUCE MOTION · NUMBER STYLE · KEYBOARD
//             SOUNDS — claude/mockups/v2/RoomSettings.dc.html).
// Everything is OFF-by-default / persisted, and the AudioContext is only created or resumed INSIDE a user gesture
// (enable*/ensureCtx run from the handlers), so nothing plays before the user asks for it.
import { useId, useState } from 'react';
import { SEASON2 } from '../progress/season';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { enableClack, disableClack, isClackEnabled } from '../progress/clack';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';
import { setReduceMotion } from '../lib/reduceMotion';
import { useReduceMotion } from '../lib/useReduceMotion';
import SettingsPanel from './SettingsPanel.jsx';
import './AudioPanel.css';

function Toggle({ on, onClick, glyph, label, accent }) {
  return (
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
}

export default function AudioPanel({ accent, musicMuted, onToggleMusic, sfxMuted, onToggleSfx, onSound, onClose }) {
  const [events, setEvents] = useState(() => isEventSoundsEnabled());
  const [clack, setClack] = useState(() => isClackEnabled());
  const [vol, setVol] = useState(() => getMasterVolume());
  // REDUCE MOTION lives in this panel too: it is the app's one settings cluster (CLAUDE.md NO ORPHAN FIXED UI). OFF by
  // default and NOT the OS setting — managed school Chromebooks force prefers-reduced-motion: reduce.
  const reduceOn = useReduceMotion();
  const motionLabelId = useId();
  const tell = () => { if (onSound) onSound({ events: isEventSoundsEnabled(), clack: isClackEnabled() }); };

  if (SEASON2) {
    return (
      <SettingsPanel
        sheet
        musicMuted={musicMuted}
        onToggleMusic={onToggleMusic}
        sfxMuted={sfxMuted}
        onToggleSfx={onToggleSfx}
        onChange={tell}
        onClose={() => { tell(); onClose(); }}
      />
    );
  }

  const toggleEvents = () => {
    if (events) { disableEventSounds(); setEvents(false); }
    else { enableEventSounds(); setEvents(true); } // creates/resumes the shared AudioContext in-gesture
    tell();
  };
  const toggleClack = () => {
    if (clack) { disableClack(); setClack(false); }
    else { enableClack(); setClack(true); } // creates/resumes the AudioContext in-gesture
    tell();
  };
  const onVol = (e) => {
    const v = Number(e.target.value) / 100;
    ensureCtx(); // user gesture — safe to warm the context so the slider is audible live
    setMasterVolume(v);
    setVol(v);
  };

  return (
    <div className="audio-panel" role="group" aria-label="Sound settings">
      <Toggle on={!musicMuted} onClick={onToggleMusic} glyph="♫" label="MUSIC" accent={accent} />
      {onToggleSfx && <Toggle on={!sfxMuted} onClick={onToggleSfx} glyph="💥" label="GAME SFX" accent={accent} />}
      <Toggle on={clack} onClick={toggleClack} glyph="⌨" label="KEYSTROKE" accent={accent} />
      <Toggle on={events} onClick={toggleEvents} glyph="🔊" label="EVENTS" accent={accent} />
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
  );
}
