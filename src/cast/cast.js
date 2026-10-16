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
/** Each member's idle beat — a finite one-shot the caller re-arms on a timer (nothing infinite). Keys are
 *  [offset, translateY %, rotate deg, scaleX, scaleY]: RIOT shakes, GLITCH leans back bored, HYPE jumps, BRAWL bounces
 *  on its toes, HEX floats. Used by the menu showcase (MainPick). */
export const CAST_BEATS = {
  riot: { ms: 820, k: [[0, 0, 0, 1, 1], [0.15, -3, -5, 1, 1], [0.32, -3, 5, 1, 1], [0.5, -2, -4, 1, 1], [0.68, -1, 3, 1, 1], [1, 0, 0, 1, 1]] },
  glitch: { ms: 1300, k: [[0, 0, 0, 1, 1], [0.3, 0, -7, 0.98, 1.01], [0.75, 0, -7, 0.98, 1.01], [1, 0, 0, 1, 1]] },
  hype: { ms: 900, k: [[0, 0, 0, 1, 1], [0.18, 2, 0, 1.08, 0.9], [0.45, -16, -3, 0.95, 1.07], [0.72, 0, 0, 1.1, 0.88], [0.86, -2, 0, 0.98, 1.03], [1, 0, 0, 1, 1]] },
  brawl: { ms: 1000, k: [[0, 0, 0, 1, 1], [0.2, -5, 4, 1, 1.03], [0.4, 0, 0, 1.04, 0.96], [0.6, -5, 4, 1, 1.03], [0.8, 0, 0, 1.04, 0.96], [1, 0, 0, 1, 1]] },
  hex: { ms: 1500, k: [[0, 0, 0, 1, 1], [0.5, -8, 3, 1, 1], [1, 0, 0, 1, 1]] },
};
export const castBeatFrames = (b) => b.k.map(([offset, y, r, sx, sy]) => ({ offset, transform: `translateY(${y}%) rotate(${r}deg) scale(${sx}, ${sy})` }));
