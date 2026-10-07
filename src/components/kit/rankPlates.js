// kit/rankPlates.js — the 16 RANK PLATES of claude/mockups/v2/KitLevelUp.dc.html (03 RANK PLATES: "NAME BADGES ·
// SHAPE + TRIM ESCALATE · ★ TIERS SHIMMER"). One entry per v3 rank (progress/v3/ranks.js RANKS_V3, keyed by `req`):
// the slab's SHAPE, its 3-stop face, the lip under it, the trim drawn BEHIND it (horns, wings, a crown, a halo) and
// IN FRONT of it (a squiggle, rivets, fangs, gems), the text colour, and — for the ★ ranks — the glow + the sheen.
// Pure data (viewBox 0 0 180 72); KitRankPlate.jsx draws it. Art is SVG paths, never CSS shapes (CLAUDE.md ART VS MOTION).
const sp = (x, y, r) => {
  const q = r * 0.3;
  return `M${x} ${y - r} L${x + q} ${y - q} L${x + r} ${y} L${x + q} ${y + q} L${x} ${y + r} L${x - q} ${y + q} L${x - r} ${y} L${x - q} ${y - q} Z`;
};
const dot = (x, y, r) => `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

const SH = {
  rect: 'M26 16 H154 V58 H26 Z',
  notch: 'M26 16 H144 L154 26 V58 H26 Z',
  key: 'M20 14 H160 L154 60 H26 Z',
  hex: 'M12 37 L28 14 H152 L168 37 L152 60 H28 Z',
  ribbon: 'M6 16 H174 L162 37 L174 58 H6 L18 37 Z',
  shield: 'M22 14 H158 L166 22 V50 L150 60 H30 L14 50 V22 Z',
  slant: 'M30 16 H164 L150 58 H16 Z',
  zig: 'M30 16 H150 L160 26 L152 31 L164 42 L150 58 H30 L20 48 L28 43 L16 31 L28 26 Z',
  oct: 'M36 14 H144 L162 26 V48 L144 60 H36 L18 48 V26 Z',
};
const AD = {
  horns: 'M44 18 L26 -2 L60 16 Z M136 18 L154 -2 L120 16 Z',
  crown: 'M66 16 L66 0 L79 9 L90 -4 L101 9 L114 0 L114 16 Z',
  caps: 'M72 16 L90 -2 L108 16 H98 V18 H82 V16 Z',
  wings: 'M30 22 L2 8 L10 23 L-4 30 L12 36 L2 50 L30 50 Z M150 22 L178 8 L170 23 L184 30 L168 36 L178 50 L150 50 Z',
  wingsS: 'M30 24 L12 16 L18 28 L8 34 L30 46 Z M150 24 L168 16 L162 28 L172 34 L150 46 Z',
  halo: 'M56 4 a34 6 0 1 0 68 0 a34 6 0 1 0 -68 0 Z M66 4 a24 3 0 1 0 48 0 a24 3 0 1 0 -48 0 Z',
  squig: 'M60 54 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4 v3 l-5 -4 l-5 4 l-5 -4 l-5 4 l-5 -4 l-5 4 l-5 -4 l-5 4 Z',
  splat: `${dot(160, 10, 6)} ${dot(22, 64, 4)} ${dot(170, 62, 3)} ${dot(10, 12, 3)}`,
  rivets: `${dot(28, 24, 3)} ${dot(152, 24, 3)} ${dot(28, 50, 3)} ${dot(152, 50, 3)}`,
  bolts: 'M10 18 L20 18 L14 30 L22 30 L6 52 L11 36 L3 36 Z M170 18 L160 18 L166 30 L158 30 L174 52 L169 36 L177 36 Z',
  fangs: 'M64 56 L69 68 L74 56 Z M106 56 L111 68 L116 56 Z',
  gems: 'M28 30 L35 37 L28 44 L21 37 Z M152 30 L159 37 L152 44 L145 37 Z',
  void: `${sp(10, 10, 8)} ${sp(172, 60, 7)} ${sp(164, 6, 4)} ${sp(16, 64, 4)}`,
};

// In RANKS_V3 order (index 0 … 15). `req` matches RANKS_V3[i].req.
export const RANK_PLATES = [
  { req: 'R0', name: 'KEYMASH', cap: 'BARE SLAB', shape: SH.rect, g: ['#7d6b98', '#7d6b98', '#6b5a85'], lip: '#3a2160', c1: '#a08cc0', txt: '#fff' },
  { req: 'R1', name: 'TYPO', cap: 'RED SQUIGGLE', shape: SH.notch, g: ['#e0d4f5', '#c9b8e8', '#c9b8e8'], lip: '#7a66a0', c1: '#c9b8e8', txt: '#000', front: AD.squig, c4: '#FF3D7F' },
  { req: 'R2', name: 'CLACKER', cap: 'KEYCAP', shape: SH.key, g: ['#8affef', '#2EFFE0', '#2EFFE0'], lip: '#12A99A', c1: '#2EFFE0', txt: '#000' },
  { req: 'R3', name: 'HOTKEY', cap: 'HEX CUT', shape: SH.hex, g: ['#FFE94A', '#FFC23D', '#FFC23D'], lip: '#b07a10', c1: '#FFC23D', txt: '#000' },
  { req: 'R4', name: 'INKSTORM', cap: 'RIBBON + INK', shape: SH.ribbon, g: ['#c77aff', '#B04BFF', '#9a3ae8'], lip: '#5c0fa3', c1: '#D88BFF', txt: '#fff', front: AD.splat, c4: '#D88BFF' },
  { req: 'R5', name: 'WORDSMITH', cap: 'FORGED + RIVETS', shape: SH.shield, g: ['#ffffff', '#e0d4f5', '#c9b8e8'], lip: '#6b5a85', c1: '#ffffff', txt: '#000', front: AD.rivets, c4: '#FFC23D' },
  { req: 'R6', name: 'KEYFIEND', cap: 'HORNS', shape: SH.slant, g: ['#ff6f9c', '#FF3D7F', '#e02866'], lip: '#a3164a', c1: '#FF3D7F', txt: '#fff', back: AD.horns, c3: '#f3e9ff' },
  { req: 'R7', name: 'CAPSLOCK', cap: 'UP ARROW', shape: SH.rect, g: ['#fff6a8', '#FFE94A', '#FFE94A'], lip: '#F2A900', c1: '#FFE94A', txt: '#000', back: AD.caps, c3: '#2EFFE0' },
  { req: 'R8', name: 'OVERCLOCK', cap: 'VOLTAGE EDGE', shape: SH.zig, g: ['#2EFFE0', '#12A99A', '#B04BFF'], lip: '#3a0f6a', c1: '#2EFFE0', txt: '#fff', front: AD.bolts, c4: '#FFE94A' },
  { req: 'R9', name: 'GLYPHLORD', cap: 'CROWNED', shape: SH.oct, g: ['#ecc4ff', '#D88BFF', '#B04BFF'], lip: '#5c0fa3', c1: '#D88BFF', txt: '#fff', back: AD.crown, c3: '#FFE94A' },
  { req: 'R10', name: 'LEXIBEAST', cap: 'WINGS + FANGS', shape: SH.shield, g: ['#FF3D7F', '#d83aa8', '#B04BFF'], lip: '#4a0a6e', c1: '#FF3D7F', txt: '#fff', back: AD.wingsS, c3: '#2EFFE0', front: AD.fangs, c4: '#fff' },
  { req: '★1', name: 'VOIDTYPER', cap: 'STARFIELD', shape: SH.oct, g: ['#2a0d4a', '#12071f', '#000000'], lip: '#000', c1: '#D88BFF', txt: '#D88BFF', front: AD.void, c4: '#fff', star: true, glow: '#B04BFF' },
  { req: '★3', name: 'ASCENDANT', cap: 'HALO + WINGS', shape: SH.shield, g: ['#ffffff', '#fff6a8', '#FFE94A'], lip: '#F2A900', c1: '#FFE94A', txt: '#000', back: `${AD.wings} ${AD.halo}`, c3: '#ffffff', star: true, glow: '#FFE94A' },
  { req: '★5', name: 'OMNIKEY', cap: 'PRISM KEYCAP', shape: SH.key, g: ['#2EFFE0', '#B04BFF', '#FF3D7F'], lip: '#3a0f6a', c1: '#2EFFE0', txt: '#fff', back: AD.wingsS, c3: '#D88BFF', front: AD.gems, c4: '#FFE94A', star: true, glow: '#2EFFE0' },
  { req: '★10', name: 'FINAL BOSS', cap: 'HORNS + CROWN', shape: SH.zig, g: ['#FF3D7F', '#a3164a', '#3a0016'], lip: '#1a0008', c1: '#FF3D7F', txt: '#FFE94A', back: `${AD.horns} ${AD.crown}`, c3: '#FFE94A', front: AD.fangs, c4: '#fff', star: true, glow: '#FF3D7F' },
  { req: '★20', name: 'ENDGAME', cap: 'EVERYTHING', shape: SH.oct, g: ['#fff6a8', '#FFE94A', '#F2A900'], lip: '#8a5a00', c1: '#FFE94A', txt: '#000', back: `${AD.wings} ${AD.crown}`, c3: '#2EFFE0', front: `${AD.gems} ${sp(90, 66, 6)}`, c4: '#FF3D7F', star: true, glow: '#FFE94A' },
];

const BY_REQ = Object.fromEntries(RANK_PLATES.map((p, i) => [p.req, { ...p, i }]));
const BY_NAME = Object.fromEntries(RANK_PLATES.map((p, i) => [p.name, { ...p, i }]));

/** The plate for a rank — by its `req` ('R5', '★10'), its name ('WORDSMITH') or its index (0–15). R0 otherwise. */
export function plateFor(rank) {
  if (Number.isInteger(rank)) return { ...RANK_PLATES[Math.max(0, Math.min(15, rank))], i: Math.max(0, Math.min(15, rank)) };
  return BY_REQ[rank] || BY_NAME[rank] || { ...RANK_PLATES[0], i: 0 };
}
