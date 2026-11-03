// faceBox.js — where each hero's HEAD sits in its 512px hero art, for the small round-cornered heads on the leaderboard
// rows (Andy nov2: "the avatars … a bit too cropped that sometimes even part of the face cannot be seen"). One fixed zoom
// cut faces that sit low (BUZZ, HEX), off-centre (JINX, FACET, LEXI) or mid-body (DRAKE, MAGMA). Each hero now names
// its own head box, measured from the art: [cx, cy, s] = the head's centre and its square size, as fractions of the art.
// An ELITE / GOLD repaint keeps its base member's pose unless it has its own entry. Pure data + one pure helper.

export const HEAD_BOX = {
  boo: [0.43, 0.4, 0.55],
  brawl: [0.46, 0.32, 0.48],
  'brawl-elite': [0.48, 0.3, 0.45],
  'brawl-gold': [0.45, 0.32, 0.48],
  buzz: [0.5, 0.42, 0.5],
  drake: [0.5, 0.47, 0.48],
  dud: [0.47, 0.33, 0.48],
  facet: [0.6, 0.4, 0.48],
  glitch: [0.48, 0.35, 0.48],
  'glitch-elite': [0.4, 0.3, 0.48],
  'glitch-gold': [0.48, 0.35, 0.48],
  hex: [0.43, 0.47, 0.55],
  'hex-elite': [0.55, 0.34, 0.45],
  'hex-gold': [0.4, 0.47, 0.55],
  hollow: [0.44, 0.4, 0.52],
  hype: [0.47, 0.4, 0.48],
  'hype-elite': [0.58, 0.3, 0.48],
  'hype-gold': [0.47, 0.4, 0.48],
  jinx: [0.62, 0.3, 0.48],
  lexi: [0.6, 0.28, 0.48],
  magma: [0.45, 0.36, 0.5],
  mecha: [0.47, 0.38, 0.5],
  nova: [0.5, 0.34, 0.48],
  quill: [0.6, 0.36, 0.48],
  riot: [0.47, 0.33, 0.52],
  'riot-elite': [0.47, 0.27, 0.48],
  'riot-gold': [0.48, 0.33, 0.52],
  salty: [0.52, 0.38, 0.52],
  shh: [0.37, 0.37, 0.52],
  sizzle: [0.46, 0.4, 0.52],
  zip: [0.5, 0.4, 0.52],
};
const FALLBACK = [0.5, 0.36, 0.52];
// how much MORE than the head the frame shows (Andy: "show more"): a little hat / fuse above, shoulders below
export const HEAD_ZOOM_OUT = 1.25;

/** The head box of a hero id (an unknown id gets the bomb-shaped default). */
export function headBox(id) {
  return HEAD_BOX[id] || HEAD_BOX[String(id || '').replace(/-(elite|gold)$/, '')] || FALLBACK;
}

/**
 * The art window a frame shows for this hero: { s, x, y } = its square size and top-left corner, as fractions of the art.
 * The head box grown by HEAD_ZOOM_OUT, centred on the head, slid (never shrunk) to stay on the art where it can.
 */
export function headWindow(id) {
  const [cx, cy, hs] = headBox(id);
  const s = Math.min(1, hs * HEAD_ZOOM_OUT);
  const clamp = (v) => Math.max(0, Math.min(1 - s, v));
  return { s, x: clamp(cx - s / 2), y: clamp(cy - s / 2) };
}

/** Inline style for the <img> inside a fixed square frame: the art scaled + offset so the frame shows headWindow(id). */
export function headImgStyle(id) {
  const { s, x, y } = headWindow(id);
  const pct = (v) => `${Math.round(v * 10000) / 100}%`;
  return { width: pct(1 / s), height: pct(1 / s), left: pct(-x / s), top: pct(-y / s) };
}
