// WaveText.jsx
// Splits a string into per-letter spans so each letter can carry a staggered
// animation-delay - the Friday Night Funkin' style title "wave" where letters
// bob up and down in sequence. The motion itself is pure CSS (.wave-letter +
// @keyframes letter-bounce, defined globally in index.css); this component only
// does the splitting and delay stagger. Spaces render as a non-breaking space
// so word gaps are preserved without an animated empty span.
export default function WaveText({ text, className = '', step = 0.12 }) {
  const str = text == null ? '' : String(text);
  return (
    <span className={className} aria-label={str}>
      {str.split('').map((ch, i) => (
        <span
          key={i}
          className="wave-letter"
          aria-hidden="true"
          style={{ animationDelay: `${(i * step).toFixed(2)}s` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}
