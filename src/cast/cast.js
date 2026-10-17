// cast.js — THE CAST (Andy oct16 "spend like 25 images … those avatars by themselves are SO plain"): five bomb buddies,
// one per player colour, each with its own look and attitude, in HERO / WIN / KO poses (art run P0, art-run/ART-RUN.md).
// Until a pose is painted it falls back to the existing seat bomb buddy of the same colour (public/wb/player-*.webp).
export const CAST = [
  { id: 'riot', name: 'RIOT', tag: 'PUNK TROUBLEMAKER', color: '#FF4FA3', dark: '#A3157C', seat: 'pink' },
  { id: 'glitch', name: 'GLITCH', tag: 'NEVER IMPRESSED', color: '#2EFFE0', dark: '#179E8B', seat: 'cyan' },
  { id: 'hype', name: 'HYPE', tag: 'LOUDEST IN THE ROOM', color: '#FFE94A', dark: '#B0A015', seat: 'yellow' },
  { id: 'brawl', name: 'BRAWL', tag: 'NEVER STAYS DOWN', color: '#FF6B3D', dark: '#B83D15', seat: 'orange' },
  { id: 'hex', name: 'HEX', tag: 'KNOWS SOMETHING', color: '#B04BFF', dark: '#5E0F9E', seat: 'purple' },
];
// painted poses that exist in public/cast/ — add `'<id>-<pose>'` as each cut file lands (no 404s, no broken frames)
const PAINTED = new Set([
  'riot-hero', 'glitch-hero', 'hype-hero', 'brawl-hero', 'hex-hero',
  // WIN / KO (oct16, ChatGPT with each HERO attached as the reference — one 2-pose sheet per member, split + cut)
  'riot-win', 'riot-ko', 'glitch-win', 'glitch-ko', 'hype-win', 'hype-ko', 'brawl-win', 'brawl-ko', 'hex-win', 'hex-ko',
]);
/** The image for a cast member's pose ('hero' | 'win' | 'ko'). */
export function castSrc(id, pose = 'hero') {
  const c = CAST.find((x) => x.id === id) || CAST[0];
  if (PAINTED.has(`${c.id}-${pose}`)) return `/cast/${c.id}-${pose}.webp`;
  // a pose not painted yet → the HERO (the caller may tip it over for a K.O.), then the seat bomb buddy
  return PAINTED.has(`${c.id}-hero`) ? `/cast/${c.id}-hero.webp` : `/wb/player-${c.seat}.webp`;
}
const KEY = 'taw.main';
export function readMain() {
  try { const v = localStorage.getItem(KEY); return CAST.some((c) => c.id === v) ? v : 'riot'; } catch { return 'riot'; }
}
export function writeMain(id) {
  try { localStorage.setItem(KEY, id); } catch { /* blocked storage */ }
}
/** Which cast member a player shows: YOU = your MAIN; anyone else = the member of their hashed seat colour (the same
 *  colour their seat / avatar uses everywhere, playerColors.fallbackColor), so a player keeps one character. */
export function castFor(id, mine = false) {
  if (mine) return CAST.find((c) => c.id === readMain()) || CAST[0];
  const s = String(id == null ? '' : id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return CAST[h % CAST.length];
}
/** Is a painted pose on disk? (castSrc falls back to HERO otherwise — a caller can tip the HERO over for a KO.) */
export function hasPose(id, pose) {
  return PAINTED.has(`${id}-${pose}`);
}
/** The cast member wearing a seat colour (the in-game palette order = CAST order: pink, cyan, yellow, orange, purple). */
export function castByColor(hex) {
  const h = String(hex || '').toLowerCase();
  return CAST.find((c) => c.color.toLowerCase() === h) || CAST.find((c) => c.seat === SEAT_BY_HEX[h]) || CAST[0];
}
const SEAT_BY_HEX = { '#ff4fa3': 'pink', '#2effe0': 'cyan', '#ffe94a': 'yellow', '#ff6b3d': 'orange', '#9a1aff': 'purple' };
/** Each member's idle beat — a SQUASH-AND-STRETCH breath (Andy oct16: the tilts "look so unnatural" — "expand up and
 *  down"): the body squashes wide, stretches tall, settles, anchored at the feet (transform-origin at the bottom), never
 *  leaving the ground and never rotating. Each member keeps its own tempo / bounciness so the cast reads as five
 *  personalities. A finite one-shot the caller re-arms on a timer (nothing infinite). Keys: [offset, scaleX, scaleY]. */
export const CAST_BEATS = {
  riot: { ms: 760, k: [[0, 1, 1], [0.3, 1.07, 0.92], [0.62, 0.95, 1.07], [0.84, 1.02, 0.98], [1, 1, 1]] }, // punchy
  glitch: { ms: 1500, k: [[0, 1, 1], [0.45, 1.03, 0.97], [0.8, 0.99, 1.02], [1, 1, 1]] }, // lazy, barely bothered
  hype: { ms: 700, k: [[0, 1, 1], [0.25, 1.09, 0.9], [0.55, 0.93, 1.09], [0.8, 1.03, 0.97], [1, 1, 1]] }, // hyper
  brawl: { ms: 900, k: [[0, 1, 1], [0.3, 1.06, 0.93], [0.6, 0.96, 1.06], [0.85, 1.02, 0.98], [1, 1, 1]] }, // on its toes
  hex: { ms: 1700, k: [[0, 1, 1], [0.5, 0.98, 1.04], [1, 1, 1]] }, // slow, smug breath
};
export const castBeatFrames = (b) => b.k.map(([offset, sx, sy]) => ({ offset, transform: `scale(${sx}, ${sy})` }));
/** A crown riding the head follows the stretch (its y in crown-heights ≈ the head's travel). */
export const castCrownFrames = (b) => b.k.map(([offset, , sy]) => ({ offset, transform: `translateY(${((1 - sy) * 350).toFixed(1)}%) rotate(-7deg)` }));
