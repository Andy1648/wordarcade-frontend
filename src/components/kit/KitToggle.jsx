// KitToggle.jsx — 05 TOGGLES (claude/mockups/v2/KitButtons.dc.html): the REDUCE MOTION switch.
// A real <button role="switch">: Space / Enter flip it; the knob slides by transform (260 ms
// overshoot) and squashes while pressed.
import './tokens.css';
import './KitToggle.css';

export function KitToggle({ checked = false, onChange, label, onText = 'ON', offText = 'OFF', className, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`ktg${checked ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => onChange && onChange(!checked)}
    >
      <span className="ktg-shadow" />
      <span className="ktg-track">
        <span className="ktg-band" />
        <span className="ktg-on">{onText}</span>
        <span className="ktg-off">{offText}</span>
      </span>
      <span className="ktg-knob">
        <span className="ktg-knob-face">
          <span className="ktg-knob-shade" />
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" focusable="false">
            {checked ? (
              <path d="M3 11 L9 17 L19 4" fill="none" stroke="#000" strokeWidth="5" strokeLinejoin="miter" strokeLinecap="square" />
            ) : (
              <path d="M4 4 L18 18 M18 4 L4 18" fill="none" stroke="#000" strokeWidth="5" />
            )}
          </svg>
        </span>
      </span>
    </button>
  );
}
