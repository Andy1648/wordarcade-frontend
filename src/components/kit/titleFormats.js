// kit/titleFormats.js — how a TITLE looks (Andy oct28: "titles … have no personality … mix it up with the design
// formats"). The 16 v3 titles (progress/v3/ranks.js) climb through SIX painted FORMATS, not one recoloured pill — each
// step up changes the object itself (claude research: titles-research.md — tier = shape / material / layer, never colour
// alone):
//
//   TAPE     R0–R2    a torn strip of masking tape, marker ink     — you just showed up
//   STICKER  R3–R5    a die-cut vinyl sticker, peeled corner      — you've been slapped on things
//   STEEL    R6–R8    a riveted steel name plate                  — forged
//   BANNER   R9–R10   a purple ribbon banner + gold crest          — crowned
//   NEON     ★1–★5    a neon sign board                           — lit up
//   MARQUEE  ★10–★20  a gold marquee with a bulb border           — the headline act
//
// The art is a painted PNG per FORMAT (public/titles/, ART VS MOTION — never CSS shapes); the name is Bungee laid on its
// calm centre. Within a format each title has its own ink. `box` = the text area as [left, top, right, bottom] insets
// (fractions of the art), `tilt` = the name's static lean, `aspect` = the art's own width / height (each painted piece keeps
// its shape — the NEON board is slim, the STICKER tall with its splats). Pure data.
export const TITLE_FORMATS = {
  tape: { label: 'TAPE', src: '/titles/title-tape-v1.png', aspect: 3.95, box: [0.12, 0.22, 0.12, 0.2], tilt: -2, stroke: 0 },
  sticker: { label: 'STICKER', src: '/titles/title-sticker-v1.png', aspect: 3.46, box: [0.12, 0.24, 0.14, 0.3], tilt: -3, stroke: 3 },
  steel: { label: 'STEEL', src: '/titles/title-plate-v1.png', aspect: 4.44, box: [0.1, 0.18, 0.1, 0.2], tilt: 0, stroke: 0 },
  banner: { label: 'BANNER', src: '/titles/title-banner-v1.png', aspect: 3.57, box: [0.16, 0.34, 0.16, 0.2], tilt: 0, stroke: 3 },
  neon: { label: 'NEON', src: '/titles/title-neon-v1.png', aspect: 5.88, box: [0.07, 0.2, 0.07, 0.2], tilt: 0, stroke: 3 },
  marquee: { label: 'MARQUEE', src: '/titles/title-marquee-v1.png', aspect: 4.01, box: [0.08, 0.32, 0.08, 0.2], tilt: -1, stroke: 4 },
};

// In RANKS_V3 order (index 0 … 15): the title's format + its ink.
export const TITLE_LOOKS = [
  { req: 'R0', name: 'INKLING', f: 'tape', ink: '#1d1430' },
  { req: 'R1', name: 'TYPO', f: 'tape', ink: '#C8321E' },
  { req: 'R2', name: 'CLACKER', f: 'tape', ink: '#1f4fbf' },
  { req: 'R3', name: 'HOTKEY', f: 'sticker', ink: '#FFE94A' },
  { req: 'R4', name: 'INKSTORM', f: 'sticker', ink: '#ffffff' },
  { req: 'R5', name: 'WORDSMITH', f: 'sticker', ink: '#2EFFE0' },
  { req: 'R6', name: 'KEYFIEND', f: 'steel', ink: '#8a1238' },
  { req: 'R7', name: 'CAPSLOCK', f: 'steel', ink: '#1d1430' },
  { req: 'R8', name: 'OVERCLOCK', f: 'steel', ink: '#0d5f8a' },
  { req: 'R9', name: 'GLYPHLORD', f: 'banner', ink: '#FFE94A' },
  { req: 'R10', name: 'LEXIBEAST', f: 'banner', ink: '#ffffff' },
  { req: '★1', name: 'VOIDTYPER', f: 'neon', ink: '#D88BFF' },
  { req: '★3', name: 'ASCENDANT', f: 'neon', ink: '#FFE94A' },
  { req: '★5', name: 'OMNIKEY', f: 'neon', ink: '#2EFFE0' },
  { req: '★10', name: 'FINAL BOSS', f: 'marquee', ink: '#FFE94A' },
  { req: '★20', name: 'ENDGAME', f: 'marquee', ink: '#ffffff' },
].map((t, i) => ({ ...t, i, fmt: TITLE_FORMATS[t.f] }));

const BY_REQ = Object.fromEntries(TITLE_LOOKS.map((t) => [t.req, t]));
const BY_NAME = Object.fromEntries(TITLE_LOOKS.map((t) => [t.name, t]));

/** The look for a title — by `req` ('R5', '★10'), name ('WORDSMITH') or ladder index (0–15). R0 otherwise. */
export function titleLook(rank) {
  if (Number.isInteger(rank)) return TITLE_LOOKS[Math.max(0, Math.min(TITLE_LOOKS.length - 1, rank))];
  return BY_REQ[rank] || BY_NAME[rank] || TITLE_LOOKS[0];
}

/** The formats in climb order, each with its titles — the picker's sections. */
export function titleSections() {
  const out = [];
  for (const t of TITLE_LOOKS) {
    const last = out[out.length - 1];
    if (last && last.f === t.f) last.titles.push(t);
    else out.push({ f: t.f, label: t.fmt.label, titles: [t] });
  }
  return out;
}

// The name's font size as a fraction of the plate's HEIGHT: as big as the text area allows, shrunk for a long name
// (Bungee caps run ~0.8 em wide). Pure — no layout read, so a list of 16 plates measures nothing.
export function nameScale(look, label) {
  const [l, t, r, b] = look.fmt.box;
  const len = Math.max(1, String(label).length);
  const byWidth = (look.fmt.aspect * (1 - l - r)) / (len * 0.8);
  const byHeight = (1 - t - b) * 0.9;
  return Math.min(byWidth, byHeight);
}
