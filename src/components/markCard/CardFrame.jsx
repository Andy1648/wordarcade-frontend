// CardFrame — THE CARD'S FRAME as vector art (NIGHT oct8 R4; CLAUDE.md ART VS MOTION: a frame is not a rectangle, so
// it is an asset, not CSS borders). One inline SVG at the card's 180×260 drawing size, under the card's text:
//
//   shadow       the whole silhouette, hard-offset 6px, black
//   frame        the tier colour, outlined in its DARKER SHADE (palette.edge — never black)
//   face         the dark tier wash, inset
//   rarity plate a notched banner across the frame's top band (the RARITY label sits on it) + one paint drip
//   backing      a 12-point rosette behind the cog so the glyph never floats on the wash (rotated 7° — asymmetry)
//   name plate   a ribbon with wings that overhang the frame (the NAME sits on it)
//   hero band    GEAR TILE v2 (Andy oct9): one tall ink band for the MAIN STAT (a locked card: its odds)
//   pip plate    a small plate on the bottom band, as wide as its pips (`pipW`; none when the card has no pips)
//   pins         LEGENDARY+ ONLY: diamond pins holding the ribbon (MYTHIC adds pins on the rarity plate; SECRET's are
//                the rainbow) — the rare card is DRAWN differently, not just recoloured (Balatro's soul layer)
//
// Pure geometry: no gradients, no filters. Colours come in as props (the tier's palette row) so one drawing serves
// every tier; every card shares ONE layout (frameLayout.LAYOUT). The text is HTML over it (MarkCard).
import { memo } from 'react';
import { RAINBOW_TEETH } from './palette.js';
import { LAYOUT as L, PLATE_H } from './frameLayout.js';

function rosette(cx, cy, r, points = 12, inner = 0.86) {
  const pts = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}
const banner = (x0, x1, y, h, notch) => `M${x0 + notch} ${y} L${x1 - notch} ${y} L${x1} ${y + h / 2} L${x1 - notch} ${y + h} L${x0 + notch} ${y + h} L${x0} ${y + h / 2} Z`;
const Pin = ({ cx, cy, fill, edge }) => (
  <g>
    <path d={`M${cx} ${cy - 8} L${cx + 7} ${cy} L${cx} ${cy + 8} L${cx - 7} ${cy} Z`} fill={fill} stroke={edge} strokeWidth="2.5" strokeLinejoin="round" />
    <circle cx={cx - 2} cy={cy - 2.5} r="1.6" fill="#fff" />
  </g>
);

function CardFrame({ line, edge, fill, tier = 'rare', locked = false, pipW = 0 }) {
  const pins = !locked && (tier === 'legendary' || tier === 'mythic' || tier === 'secret');
  const headPins = !locked && (tier === 'mythic' || tier === 'secret');
  const pinFill = (i) => (tier === 'secret' ? RAINBOW_TEETH[i % RAINBOW_TEETH.length] : line);
  return (
    <svg className="mc-frame" viewBox="0 0 180 260" width="180" height="260" aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
      {/* the hard shadow: the silhouette (frame + the ribbon's wings), offset */}
      <g transform="translate(6 6)" fill="#000">
        <rect x="2" y="2" width="176" height="256" rx="14" />
        <path d={banner(2, 178, L.name, PLATE_H.name, 6)} />
      </g>
      {/* the frame in the tier colour, outlined in its darker shade */}
      <rect x="2" y="2" width="176" height="256" rx="14" fill={line} stroke={edge} strokeWidth="5" />
      {/* the face: the dark tier wash */}
      <rect x="11" y="42" width="158" height="186" rx="8" fill={fill} stroke={edge} strokeWidth="3" />
      {/* the rarity plate on the top band, with one drip off its right end (personality) */}
      <path d={banner(9, 171, 9, 28, 7)} fill={edge} stroke={fill} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M150 37 C150 44 148 48 151 52 C154 48 153 44 153 37 Z" fill={edge} />
      {/* the backing rosette behind the cog */}
      <path d={rosette(90, L.artC, L.artR)} fill={edge} stroke={fill} strokeWidth="3" strokeLinejoin="round" transform={`rotate(7 90 ${L.artC})`} />
      {/* the name ribbon: wings overhang the frame */}
      <path d={banner(2, 178, L.name, PLATE_H.name, 6)} fill={line} stroke={edge} strokeWidth="3" strokeLinejoin="round" />
      {/* the hero band (ink): the MAIN STAT — or, locked, the odds */}
      <rect x="5" y={L.hero} width="170" height={PLATE_H.hero} rx="6" fill="#0d0618" stroke={edge} strokeWidth="2.5" />
      {/* the pip plate on the bottom band, sized to its pips */}
      {pipW ? <rect x={90 - pipW / 2} y={L.pips} width={pipW} height={PLATE_H.pips} rx="4" fill={fill} stroke={edge} strokeWidth="2" /> : null}
      {/* LEGENDARY+: the pins */}
      {pins ? <Pin cx={8} cy={L.name + PLATE_H.name / 2} fill={pinFill(0)} edge={edge} /> : null}
      {pins ? <Pin cx={172} cy={L.name + PLATE_H.name / 2} fill={pinFill(1)} edge={edge} /> : null}
      {headPins ? <Pin cx={10} cy={23} fill={pinFill(2)} edge={edge} /> : null}
      {headPins ? <Pin cx={170} cy={23} fill={pinFill(3)} edge={edge} /> : null}
    </svg>
  );
}

export default memo(CardFrame);
