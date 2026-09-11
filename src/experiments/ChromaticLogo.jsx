// ChromaticLogo.jsx — PHASE 7b prototype. NOT SHIPPED. Behind ?x7b=1.
//
// Today's menu wordmark is Bungee Shade in flat #FF4FA3 with a 5px black stroke: one
// colour, with all its depth coming from the font's own baked 3D body. This variant asks
// whether it is better as a real CHROMATIC LOCKUP - the way a chromatic type family is
// meant to be used, each shipped layer drawn in its own colour and registered exactly on
// top of the last.
//
// ------------------------------------------------------------------------------------
// THE THING THAT DECIDED THE DESIGN: BUNGEE SHADE DOES NOT REGISTER.
// The obvious lockup is Shade (3D body) + regular (face) + Inline + Outline. It does not
// work, and the first build of this prototype shipped visibly doubled letters because I
// assumed it would. Measured at 96px, "TYPE A WORD":
//
//     Bungee          664.72px
//     Bungee Inline   664.72px   same
//     Bungee Outline  664.72px   same
//     Bungee Shade    770.31px   +105.59px  (+15.9%)
//
// Bungee, Inline and Outline are metrically identical and stack perfectly. Shade bakes
// its 3D offset into every glyph's ADVANCE, so it gains roughly 9.6px per character and
// its letters walk steadily rightward away from the others. No single transform fixes
// that - the drift is cumulative per character, not a constant offset.
//
// So the lockup is built from the three faces that do register, and the depth that Shade
// used to provide is supplied instead by a hard offset copy of the solid face in black -
// which is the house idiom for depth anyway (flat colours, hard offset shadows, no blur).
//
// Layers, back to front:
//   1. Bungee, near-black, offset +7px/+7px  - the depth, as a hard offset shadow.
//   2. Bungee, #FF4FA3                        - the solid letter face.
//   3. Bungee Inline, #FFE94A                 - the same letter with its inset line
//                                               knocked out; the pink below shows through
//                                               the knockout, which is where the second
//                                               colour inside one letter comes from.
//   4. Bungee Outline, black                  - the edge, so the lockup still sits on the
//                                               hard black line the rest of the menu uses.
//
// The two extra layer fonts are NOT added to index.html - they are injected at runtime,
// only when the flag is on, so the default build's font payload is untouched and the
// side-by-side is not secretly also a comparison of load behaviour. That injection is
// also the strongest argument AGAINST shipping this, and it is in the report rather than
// buried here: two more woff2 files on the critical path for the largest, earliest
// element on the site.
import { useEffect, useState } from 'react';

const LAYER_FONTS_ID = 'x7b-bungee-layers';
const HREF =
  'https://fonts.googleapis.com/css2?family=Bungee+Inline&family=Bungee+Outline&display=swap';

export default function ChromaticLogo({ text, className = '' }) {
  // The extra layers stay hidden until BOTH faces have actually loaded. With
  // display=swap each layer swaps from its fallback independently, and a fallback face
  // has different metrics, so a layer that has swapped sitting over one that has not is
  // visibly doubled for as long as the mismatch lasts. Showing one clean layer and then
  // the full lockup is the honest failure mode; showing garbage is not.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    if (!document.getElementById(LAYER_FONTS_ID)) {
      const link = document.createElement('link');
      link.id = LAYER_FONTS_ID;
      link.rel = 'stylesheet';
      link.href = HREF;
      document.head.appendChild(link);
      // Deliberately NOT removed on unmount: yanking a stylesheet the painted wordmark is
      // still using would reflow it mid-transition out of the menu.
    }
    const want = ['1em "Bungee Inline"', '1em "Bungee Outline"', '1em "Bungee"'];
    Promise.all(want.map((f) => document.fonts.load(f, text).catch(() => null)))
      .then(() => {
        if (live) setReady(want.every((f) => document.fonts.check(f)));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [text]);

  return (
    <div
      className={`homepage-logo x7b-logo ${ready ? 'is-ready' : ''} ${className}`}
      role="img"
      aria-label="Type a Word"
    >
      {/* Only the top layer is in flow and sets the box; the rest are pinned to it, so
          the lockup measures exactly like the single-layer wordmark it replaces and the
          menu's fit maths (--menu-scale, the title<->XP gap floor) is unaffected. */}
      <span className="x7b-layer x7b-depth" aria-hidden="true">{text}</span>
      <span className="x7b-layer x7b-solid" aria-hidden="true">{text}</span>
      <span className="x7b-layer x7b-inline" aria-hidden="true">{text}</span>
      <span className="x7b-flow">{text}</span>
    </div>
  );
}
