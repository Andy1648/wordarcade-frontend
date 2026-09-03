// WaveText.jsx
// Splits a string into per-letter spans so each letter can carry a staggered
// animation-delay - the Friday Night Funkin' style title "wave" where letters
// bob up and down in sequence. The motion itself is pure CSS (.wave-letter +
// @keyframes letter-bounce, defined globally in index.css); this component only
// does the splitting and delay stagger. Spaces render as a non-breaking space
// so word gaps are preserved without an animated empty span.
// A11y (MED-3): the accessible name is a real visually-hidden text node, NOT an `aria-label` on a
// generic <span> (axe `aria-prohibited-attr` — a role=generic span can't take an accessible name via
// aria-label). The decorative per-letter spans are wrapped in an aria-hidden container so screen
// readers read the whole word once, not letter-by-letter.
const SR_ONLY = {
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px',
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
};

export default function WaveText({ text, className = '', step = 0.12 }) {
  const str = text == null ? '' : String(text);
  return (
    <span className={className}>
      <span style={SR_ONLY}>{str}</span>
      <span aria-hidden="true">
      {str.split('').map((ch, i) => (
        <span
          key={i}
          className="wave-letter"
          style={{ animationDelay: `${(i * step).toFixed(2)}s` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
      </span>
    </span>
  );
}
