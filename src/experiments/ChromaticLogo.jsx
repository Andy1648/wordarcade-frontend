// ChromaticLogo.jsx — PHASE 7b prototype. NOT SHIPPED. Behind ?x7b=1.
//
// Today's menu wordmark is Bungee Shade in flat #FF4FA3 with a 5px black stroke: one
// colour, with all its depth coming from the font's own baked shade. This variant asks
// whether the wordmark is better as a real CHROMATIC LOCKUP - the way a chromatic type
// family is meant to be used, with each of Bungee's shipped layer fonts drawn in its own
// colour and registered exactly on top of the last.
//
// The layers, back to front. They are the same family at the same size, so their advance
// widths are identical by design and they register without any nudging:
//   1. Bungee Shade   - the 3D body, in a dark purple, so the extrude reads as its own
//                       material rather than as a darker pink.
//   2. Bungee         - the solid letter face, in the canonical #FF4FA3.
//   3. Bungee Inline  - the same letter with its inset line knocked out, in yellow. The
//                       pink beneath shows through the knockout, which is where the
//                       "chromatic" actually comes from - two colours inside one letter.
//   4. Bungee Outline - the outline alone, in black, so the whole lockup still sits on
//                       the hard black edge the rest of the menu is drawn with.
//
// The two extra layer fonts are NOT added to index.html. They are injected at runtime,
// only when the flag is on, so the default build's font payload is untouched and the
// side-by-side comparison is not secretly also a comparison of load behaviour. That
// injection is also the strongest argument AGAINST shipping this, and it is stated in
// the report rather than hidden here: it is two more woff2 files on the critical path
// for the largest, earliest-painted element on the site.
import { useEffect } from 'react';

const LAYER_FONTS_ID = 'x7b-bungee-layers';
const HREF =
  'https://fonts.googleapis.com/css2?family=Bungee+Inline&family=Bungee+Outline&display=swap';

export default function ChromaticLogo({ text, className = '' }) {
  useEffect(() => {
    if (document.getElementById(LAYER_FONTS_ID)) return;
    const link = document.createElement('link');
    link.id = LAYER_FONTS_ID;
    link.rel = 'stylesheet';
    link.href = HREF;
    document.head.appendChild(link);
    // Deliberately NOT removed on unmount: yanking a stylesheet the painted wordmark is
    // still using would reflow it mid-transition out of the menu.
  }, []);

  return (
    <div className={`homepage-logo x7b-logo ${className}`} role="img" aria-label="Type a Word">
      {/* Only the top layer is in flow and sets the box; the rest are pinned to it, so
          the lockup measures exactly like the single-layer wordmark it replaces and the
          menu's fit maths (--menu-scale, the title<->XP gap floor) is unaffected. */}
      <span className="x7b-layer x7b-shade" aria-hidden="true">{text}</span>
      <span className="x7b-layer x7b-solid" aria-hidden="true">{text}</span>
      <span className="x7b-layer x7b-inline" aria-hidden="true">{text}</span>
      <span className="x7b-flow">{text}</span>
    </div>
  );
}
