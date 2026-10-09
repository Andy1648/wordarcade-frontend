// FitText.jsx — a one-line value that SHRINKS to its box instead of running out of it (Andy oct9: "make sure things
// fit — my UPGRADES 3,750 is going off the box, so are some of the ranks, so is gear"). The text keeps its designed
// size whenever it fits; only a value wider than its box is scaled down (transform: scale, origin at the start edge —
// compositor-only, no font-size churn).
//
// PERF (CLAUDE.md ANIMATION BUDGET): measured on mount, when the TEXT changes, and when the BOX resizes (one
// ResizeObserver) — never per frame or per keystroke. Two reads (box width, natural text width), one write.
import { useLayoutEffect, useRef } from 'react';
import './FitText.css';

export default function FitText({ children, className = '', min = 0.45, as: Tag = 'span', ...rest }) {
  const boxRef = useRef(null);
  const inRef = useRef(null);
  const text = typeof children === 'string' || typeof children === 'number' ? String(children) : null;

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = inRef.current;
    if (!box || !inner) return undefined;
    const fit = () => {
      const avail = box.clientWidth;
      const need = inner.scrollWidth;
      const k = avail > 0 && need > avail ? Math.max(min, avail / need) : 1;
      inner.style.transform = k < 1 ? `scale(${k.toFixed(3)})` : '';
    };
    fit();
    // the display font lands AFTER first paint (Bungee is wider than its fallback): measure again once it has
    let live = true;
    const onFonts = () => { if (live) fit(); };
    const fonts = typeof document !== 'undefined' ? document.fonts : null;
    if (fonts && fonts.ready) fonts.ready.then(onFonts);
    if (fonts && fonts.addEventListener) fonts.addEventListener('loadingdone', onFonts); // a webfont that starts loading later
    if (typeof ResizeObserver === 'undefined') return () => { live = false; if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', onFonts); };
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    ro.observe(inner); // the text's own width changes when a font swaps in
    return () => { live = false; ro.disconnect(); if (fonts && fonts.removeEventListener) fonts.removeEventListener('loadingdone', onFonts); };
  }, [text, min]);

  return (
    <Tag ref={boxRef} className={`fit-box ${className}`} {...rest}>
      <span ref={inRef} className="fit-in">{children}</span>
    </Tag>
  );
}
