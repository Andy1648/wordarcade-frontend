// ClackButton.jsx — the keyboard-sound control, in the existing bottom-right corner
// cluster next to the music toggle (NOT new homepage real estate). A ⌨ on/off toggle
// plus, when on, a profile pill that cycles thock → clack → cream. Default OFF; the
// AudioContext is created/resumed inside the enabling click gesture (see clack.js).
import { useState } from 'react';
import {
  enableClack,
  disableClack,
  getClackProfile,
  setClackProfile,
  CLACK_PROFILES,
} from '../progress/clack';
import './ClackButton.css';

export default function ClackButton({ accent = '#FFE94A' }) {
  const [on, setOn] = useState(false);
  const [profile, setProfile] = useState(() => getClackProfile());

  const toggle = () => {
    if (on) {
      disableClack();
      setOn(false);
    } else {
      // Create/resume the AudioContext INSIDE this click gesture (autoplay-policy safe).
      enableClack(profile);
      setOn(true);
    }
  };

  const cycle = () => {
    const i = CLACK_PROFILES.indexOf(profile);
    const next = CLACK_PROFILES[(i + 1) % CLACK_PROFILES.length];
    setClackProfile(next); // persists to taw.clack; takes effect on the next keystroke
    setProfile(next);
  };

  return (
    <div className="clack-ctrl">
      {on && (
        <button
          type="button"
          className="clack-profile"
          style={{ borderColor: accent, color: accent }}
          onClick={cycle}
          title={`Keyboard sound: ${profile} (tap to change)`}
          aria-label={`Keyboard sound profile: ${profile}. Tap to change.`}
        >
          {profile}
        </button>
      )}
      <button
        type="button"
        className={`clack-btn${on ? '' : ' off'}`}
        style={{ borderColor: accent, color: accent }}
        onClick={toggle}
        title={on ? 'Keyboard sound: on' : 'Keyboard sound: off'}
        aria-label={on ? 'Turn keyboard sound off' : 'Turn keyboard sound on'}
        aria-pressed={on}
      >
        ⌨
      </button>
    </div>
  );
}
