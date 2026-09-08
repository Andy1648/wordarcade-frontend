// modifierIcon.js (feat/run-share) — rasterise a modifier's authored SVG motif (ModifierArt) to a
// data: URL so the share card (a <canvas>) can draw the drafted HAND as real icons. Static markup
// only — no DOM mount, no CSS; the SVG is self-contained (inline fills/strokes). Bungee text inside
// a motif falls back to a system font on the canvas (web fonts don't load inside an <img> SVG),
// which is acceptable for a 128px icon. Memoised per id.
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import ModifierArt from './ModifierArt.jsx';

const cache = new Map();

export function modifierIconDataUrl(id) {
  if (cache.has(id)) return cache.get(id);
  let url = null;
  try {
    const svg = renderToStaticMarkup(createElement(ModifierArt, { id, className: 'share-mod-icon' }));
    // The motif is authored at 100×100 with `slice` — give the standalone file explicit dimensions
    // and a dark field so it never renders transparent/oversized in the canvas.
    const withSize = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" ');
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withSize)}`;
  } catch {
    url = null; // the card just skips the icon
  }
  cache.set(id, url);
  return url;
}
