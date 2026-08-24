// ClackButton.jsx — the keyboard-sound ON/OFF toggle, in the existing bottom-right corner
// cluster next to the music toggle (NOT new homepage real estate). Which sound plays (the
// pack) is chosen in the SHOP now, so this is just the on/off switch. Default ON; the
// AudioContext is created/resumed inside the enabling click gesture (see clack.js).
import { useState } from 'react';
import { enableClack, disableClack, isClackEnabled } from '../progress/clack';
import './ClackButton.css';

export default function ClackButton({ accent = '#FFE94A' }) {
  const [on, setOn] = useState(() => isClackEnabled());

  const toggle = () => {
    if (on) {
      disableClack();
      setOn(false);
    } else {
      enableClack(); // creates/resumes the AudioContext inside this gesture
      setOn(true);
    }
  };

  return (
    <div className="clack-ctrl">
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
