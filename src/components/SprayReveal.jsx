// SprayReveal.jsx
// A reusable "spray-paint reveal": a directional masked sweep with a soft, patchy
// overspray edge, so on-brand graffiti text appears as if being sprayed on.
//
// PURELY PRESENTATIONAL. It wraps real, selectable, screen-reader-readable text
// and only masks it VISUALLY (the DOM is never split into per-letter nonsense).
// Re-key it (key={...}) to replay when the underlying text changes (e.g. a new
// Category Blitz category each round). Under prefers-reduced-motion it skips the
// sweep and simply fades the text in - still fully readable. CSS-only animation
// (a GPU mask), no per-frame JS, no images, no canvas.
//
// Props:
//   direction : 'left' (reveal left->right, default) | 'right' (right->left)
//   duration  : sweep length in ms (default 700)
//   delay     : start delay in ms (default 0) - use to stagger several reveals
//   className : extra classes to merge onto the wrapper
import './SprayReveal.css';

export default function SprayReveal({
  children,
  direction = 'left',
  duration = 700,
  delay = 0,
  className = '',
}) {
  return (
    <span
      className={`spray-reveal spray-${direction}${className ? ` ${className}` : ''}`}
      style={{ '--spray-dur': `${duration}ms`, '--spray-delay': `${delay}ms` }}
    >
      {children}
    </span>
  );
}
