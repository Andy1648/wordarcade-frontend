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
    // A scale() is visual only: the line box still lays out the UNSCALED width, which spills past the box and gives
    // every scrolling ancestor a phantom sideways scroll (oct20 UI audit: the profile panel scrolled 94px sideways on a
    // phone). Negative inline margins pull the layout width back to what is drawn, on the side the origin leaves free.
    const end = box.classList.contains('fit-end');
    const centre = box.classList.contains('fit-center');
    const fit = () => {
      // the CONTENT width: a padded box (the podium name) would otherwise scale its text to fit over its own padding
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      const need = inner.scrollWidth;
      const k = avail > 0 && need > avail ? Math.max(min, avail / need) : 1;
      inner.style.transform = k < 1 ? `scale(${k.toFixed(3)})` : '';
      const d = k < 1 ? need * (1 - k) : 0;
      inner.style.marginLeft = d && (end || centre) ? `${-(centre ? d / 2 : d).toFixed(1)}px` : '';
      inner.style.marginRight = d && !end ? `${-(centre ? d / 2 : d).toFixed(1)}px` : '';
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
