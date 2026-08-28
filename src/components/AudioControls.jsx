// AudioControls.jsx — the EVENT-SOUND toggle (🔊) + a MASTER VOLUME slider (Job 11), in the same
// bottom-right corner cluster as the keyboard (⌨) and music (♫) toggles. Three separate toggles is
// deliberate: keystroke sound is its own switch because typing sound is a documented misophonia
// trigger. All persisted; default OFF (school-lab audience). The slider is revealed by a small ▾ so
// the corner stays tidy; its value persists live.
import { useState } from 'react';
import './AudioControls.css';
import { enableEventSounds, disableEventSounds, isEventSoundsEnabled } from '../audio/gameSounds';
import { getMasterVolume, setMasterVolume, ensureCtx } from '../audio/audioCore';

export default function AudioControls({ accent = '#2EFFE0' }) {
  const [on, setOn] = useState(() => isEventSoundsEnabled());
  const [vol, setVol] = useState(() => getMasterVolume());
  const [open, setOpen] = useState(false);

  const toggle = () => {
    if (on) {
      disableEventSounds();
      setOn(false);
    } else {
      enableEventSounds(); // creates/resumes the shared AudioContext in this gesture
      setOn(true);
    }
  };
  const onVol = (e) => {
    const v = Number(e.target.value) / 100;
    ensureCtx(); // this is a user gesture — safe to warm the context so the slider is audible live
    setMasterVolume(v);
    setVol(v);
  };

  return (
    <div className="audio-ctrl">
      <button
        type="button"
        className={`audio-btn${on ? '' : ' off'}`}
        style={{ borderColor: accent, color: accent }}
        onClick={toggle}
        title={on ? 'Event sounds: on' : 'Event sounds: off'}
        aria-label={on ? 'Turn event sounds off' : 'Turn event sounds on'}
        aria-pressed={on}
      >
        🔊
      </button>
      <button
        type="button"
        className="audio-vol-toggle"
        style={{ borderColor: accent, color: accent }}
        onClick={() => setOpen((o) => !o)}
        title="Master volume"
        aria-label="Master volume"
        aria-expanded={open}
      >
        ▾
      </button>
      {open && (
        <div className="audio-vol-popover">
          <label className="audio-vol-label">VOLUME</label>
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
      )}
    </div>
  );
}
