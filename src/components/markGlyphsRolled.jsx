// markGlyphsRolled.jsx — the MARK ROLLS glyphs (the 27 rollable marks + the 6 permanent), split out of MarkBadge.jsx
// so they load with the MARKS panel, not on the menu's first paint (payload ratchet, PR #156). MarkBadge registers
// them on demand: MarksIndex / RollScreen import this module, and a badge for an id it can't draw yet (the menu chip
// of a worn mark) loads it once and re-draws.
//
// NIGHT oct8 4b: the ROLLABLE glyphs are drawn in the KIT construction (kit/kitIconsCore.js): one bold silhouette,
// a BASE fill + ONE darker SHADE plane on its lower-right (flat, no stroke, between fill and outline), an INK outline,
// exactly ONE white glint (upper-left) and ONE asymmetric detail (a spark, a drip, a trailing line, a crack). Their
// shade + glint live in the art, so markGlyphFinish.jsx skips them (KIT_DRAWN). Each glyph keeps its object's own
// colours — rarity colour is the cog's job, never the glyph's. Stroke-drawn forms (chains, rings, streams) get their
// shade by laying the base colour over the shade colour nudged up-left, so the shade shows on the lower-right edge.
export { GLYPH_FINISH } from './markGlyphFinish.jsx';

const INK = '#0d0618';
/** GEAR ART v1 (Andy oct10): a painted sticker (public/gear/<name>.webp, 256px, background cut) in place of the kit
 * glyph. Its ink outline + highlights are in the art, so it fills the whole 100 box (it overhangs the cog's face, like
 * the kit glyphs do). */
const ART = (name) => <image href={`/gear/${name}.webp`} x="6" y="6" width="88" height="88" />; // inside the cog ring (Andy oct11: the painted gear sat over the cog)

export const ROLLED_GLYPHS = {
  // ---- the 27 ROLLABLE marks, kit construction ----
  'mk-detonator': ART('matchstick'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/matchstick.svg filler)
  'mk-cyclone': ART('piggybank'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/piggybank.svg filler)
  'mk-scholar': ART('pencil'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/pencil.svg filler)
  'mk-ouroboros': ART('stickynote'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/stickynote.svg filler)
  'mk-tinder': ART('battery'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/battery.svg filler)
  'mk-slipstream': ART('luckysock'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/sock.svg filler)
  'mk-smith': ART('coffeemug'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/coffeemug.svg filler)
  'mk-phoenix': ART('stapler'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/stapler.svg filler)
  'mk-metronome': ART('eggtimer'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/eggtimer.svg filler)
  'mk-pyro': ART('cashregister'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/cashregister.svg filler)
  'mk-nova': ART('boombox'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/boombox.svg filler)
  'mk-golem': ART('cartridge'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/cartridge.svg filler)
  'mk-leviathan': ART('leviathan'),
  'mk-eclipse': ART('eclipse'),
  'mk-singularity': ART('singularity'),
  'mk-kraken': ART('kraken'),
  'mk-origin': ART('origin'),
  // ---- GEAR POOL v2 (Andy oct9): the 10 new gears, same kit construction (base + ONE shade plane, ink outline, ONE
  // glint upper-left, ONE asymmetric detail). Placeholder-grade: flagged for a real art pass in the PR. ----
  'mk-hotwire': ART('sneaker'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/sneaker.svg filler)
  'mk-grapple': ART('paperclip'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/paperclip.svg filler)
  'mk-sparkplug': ART('usbstick'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/usbstick.svg filler)
  'mk-brainstorm': ART('quizbuzzer'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/buzzer.svg filler)
  'mk-flashpoint': ART('flashpoint'), // Andy oct11: painted PNG (public/gear/flashpoint.webp)
  'mk-voltage': ART('voltage'), // Andy oct11: painted PNG (public/gear/voltage.webp)
  'mk-talisman': ART('magic8ball'), // oct17 night: painted (Gemini, matched to the painted set; was the fill/eightball.svg filler)
  'mk-headmaster': ART('headmaster'), // Andy oct11: painted PNG (public/gear/headmaster.webp)
  'mk-thunderclap': ART('thunderclap'), // Andy oct11: painted PNG (public/gear/thunderclap.webp)
  'mk-jackpot': ART('jackpot'), // Andy oct11: painted PNG (public/gear/jackpot.webp)
  'mk-hydra': ART('hydra'), // Andy oct11: the painted PNG (public/gear/hydra.webp, background cut out)
  // ---- the 6 PERMANENT marks (finished by markGlyphFinish.jsx) ----
  'mk-ironhand': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M30 44 C30 36 40 34 42 40 C44 32 54 32 55 40 C58 33 67 34 67 42 C72 40 76 46 74 54 L70 70 L36 72 C30 64 28 54 30 44 Z" fill="#CFD8E3" />
      <path d="M42 40 L43 52 M55 40 L55 51 M67 42 L66 52" strokeWidth="2.5" fill="none" />
      <rect x="36" y="70" width="34" height="10" rx="2" fill="#5F6F84" />
    </g>
  ),
  'mk-marathon': (
    <g strokeLinejoin="round" strokeLinecap="round">
      <path d="M24 80 C38 66 64 70 54 56 C46 44 58 38 62 32" fill="none" stroke={INK} strokeWidth="13" />
      <path d="M24 80 C38 66 64 70 54 56 C46 44 58 38 62 32" fill="none" stroke="#FFE94A" strokeWidth="3" strokeDasharray="5 5" />
      <path d="M62 34 L62 18" stroke={INK} strokeWidth="3.5" />
      <path d="M62 18 L77 21 L71 25 L77 29 L62 28 Z" fill="#FF4FA3" stroke={INK} strokeWidth="3" />
    </g>
  ),
  'mk-blaze': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M52 20 C60 32 74 40 70 58 C67 72 56 78 46 78 C34 76 26 64 30 52 C32 44 38 42 40 36 C44 42 46 44 48 40 C50 34 48 26 52 20 Z" fill="#FF4FA3" />
      <path d="M48 76 C40 72 38 62 44 56 C46 60 50 60 52 56 C58 60 60 70 54 75 Z" fill="#FFE94A" strokeWidth="2.5" />
      <path d="M16 46 L24 46 M14 58 L24 58" stroke="#FF6B3D" strokeWidth="4" />
    </g>
  ),
  'mk-ritual': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="26" y="30" width="48" height="44" rx="4" fill="#fff" transform="rotate(4 50 52)" />
      <path d="M27 40 L73 43" stroke="#FF6B3D" strokeWidth="8" />
      <path d="M36 26 L36 34 M62 28 L62 36" strokeWidth="4" />
      <path d="M36 56 L41 61 L50 50 M52 63 L56 67 L64 57" stroke="#9A1AFF" strokeWidth="4" fill="none" />
    </g>
  ),
  'mk-grandmaster': (
    <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
      <path d="M48 18 L52 18 L52 22 L56 22 L56 26 L52 26 L52 30 L48 30 L48 26 L44 26 L44 22 L48 22 Z" fill="#FFE94A" strokeWidth="2.5" />
      <path d="M40 34 L60 32 L56 56 L44 56 Z" fill="#9A1AFF" />
      <path d="M38 56 L62 56 L66 70 L34 72 Z" fill="#9A1AFF" />
      <rect x="30" y="70" width="40" height="8" rx="2" fill="#5c0fa3" transform="rotate(-3 50 74)" />
    </g>
  ),
  'mk-omega': (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <path d="M29 74 L42 74 L42 66 C30 60 28 44 36 36 C44 28 58 28 66 36 C74 44 72 60 60 66 L60 74 L73 73" stroke={INK} strokeWidth="12" />
      <path d="M29 74 L42 74 L42 66 C30 60 28 44 36 36 C44 28 58 28 66 36 C74 44 72 60 60 66 L60 74 L73 73" stroke="#FF6B3D" strokeWidth="5" />
    </g>
  ),
};
