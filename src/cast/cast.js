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
// ELITE (oct17, Andy: "elite cards will need to be noticably better … bc they will cost gems"): a full premium redesign
// of each member (ChatGPT, the HERO as the reference), bought once with gems and kept. Same colour / seat / idle beat as
// its base member; only the HERO pose is painted (castSrc falls every other pose back to it).
export const ELITE_PRICE = 2500;
export const ELITE = [
  { id: 'riot-elite', base: 'riot', name: 'ROCKSTAR RIOT', tag: 'HEADLINES EVERY ROUND' },
  { id: 'glitch-elite', base: 'glitch', name: 'GLITCH.EXE', tag: 'ALREADY IN YOUR FILES' },
  { id: 'hype-elite', base: 'hype', name: 'MVP HYPE', tag: 'LOUDER. AND GOLD.' },
  { id: 'brawl-elite', base: 'brawl', name: 'CHAMP BRAWL', tag: 'UNDISPUTED. UNBOTHERED.' },
  { id: 'hex-elite', base: 'hex', name: 'ARCHMAGE HEX', tag: 'KNOWS EVERYTHING NOW' },
].map((e) => ({ ...CAST.find((c) => c.id === e.base), ...e, elite: true, price: ELITE_PRICE }));
// INTERMEDIATE (Andy oct17: "picking 1 or 2 of the 5 to cost gems as well"): two of the crew cost gems — HEX (the
// mystic) and GLITCH (the layered-props showcase); RIOT / HYPE / BRAWL stay free. Anyone already playing one keeps it
// (grandfathered once, readMain).
export const HERO_PRICE = { hex: 750, glitch: 750 };
for (const c of CAST) if (HERO_PRICE[c.id]) c.price = HERO_PRICE[c.id];
export const ALL_HEROES = [...CAST, ...ELITE];
export const heroById = (id) => ALL_HEROES.find((x) => x.id === id) || null;
// owned ELITE ids — a season-2 progress key (taw.s2.*), so the save backup / cloud save carry it with the gems paid
export const HEROES_KEY = 'taw.s2.heroes';
/** The bought heroes (ELITEs + priced crew), validated. */
export function ownedHeroes() {
  try {
    const v = JSON.parse(localStorage.getItem(HEROES_KEY) || '[]');
    return Array.isArray(v) ? v.filter((id) => ALL_HEROES.some((h) => h.id === id && h.price)) : [];
  } catch { return []; }
}
export const ownsHero = (id) => {
  const h = ALL_HEROES.find((x) => x.id === id);
  return !!h && (!h.price || ownedHeroes().includes(id));
};
// painted poses that exist in public/cast/ — add `'<id>-<pose>'` as each cut file lands (no 404s, no broken frames)
const PAINTED = new Set([
  'riot-hero', 'glitch-hero', 'hype-hero', 'brawl-hero', 'hex-hero',
  // WIN / KO (oct16, ChatGPT with each HERO attached as the reference — one 2-pose sheet per member, split + cut)
  'riot-win', 'riot-ko', 'glitch-win', 'glitch-ko', 'hype-win', 'hype-ko', 'brawl-win', 'brawl-ko', 'hex-win', 'hex-ko',
  'riot-elite-hero', 'glitch-elite-hero', 'hype-elite-hero', 'brawl-elite-hero', 'hex-elite-hero',
]);
/** The image for a cast member's pose ('hero' | 'win' | 'ko'). */
export function castSrc(id, pose = 'hero') {
  const c = heroById(id) || CAST[0];
  if (PAINTED.has(`${c.id}-${pose}`)) return `/cast/${c.id}-${pose}.webp`;
  // a pose not painted yet → the HERO (the caller may tip it over for a K.O.), then the seat bomb buddy
  return PAINTED.has(`${c.id}-hero`) ? `/cast/${c.id}-hero.webp` : `/wb/player-${c.seat}.webp`;
}
const KEY = 'taw.main';
const GRANDFATHER_KEY = 'taw.s2.heroes.gf';
export function readMain() {
  try {
    const v = localStorage.getItem(KEY);
    if (!v || !heroById(v)) return 'riot';
    if (HERO_PRICE[v] && !ownsHero(v) && !localStorage.getItem(GRANDFATHER_KEY)) {
      // already playing a crew member that became priced (oct17) → it's yours; checked once per save
      localStorage.setItem(HEROES_KEY, JSON.stringify([...ownedHeroes(), v]));
    }
    if (!localStorage.getItem(GRANDFATHER_KEY)) localStorage.setItem(GRANDFATHER_KEY, '1');
    return ownsHero(v) ? v : 'riot';
  } catch { return 'riot'; }
}
export function writeMain(id) {
  try { localStorage.setItem(KEY, id); } catch { /* blocked storage */ }
}
/** Which cast member a player shows: YOU = your MAIN; anyone else = the member of their hashed seat colour (the same
 *  colour their seat / avatar uses everywhere, playerColors.fallbackColor), so a player keeps one character. */
export function castFor(id, mine = false) {
  if (mine) return heroById(readMain()) || CAST[0];
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
for (const e of ELITE) CAST_BEATS[e.id] = CAST_BEATS[e.base]; // an ELITE keeps its member's tempo
export const castBeatFrames = (b) => b.k.map(([offset, sx, sy]) => ({ offset, transform: `scale(${sx}, ${sy})` }));
/** LAYERED PROPS (oct16 pilot — GLITCH's gum; handoff "props as separate pieces"): a pose can be painted PROP-LESS
 *  (`base`) with each prop its own sprite, placed at a per-pose anchor so it can animate on its own (the gum inflates
 *  and pops) without moving the body. Boxes are % of the 512 pose square: x/y/w = the sprite's top-left + width; `o`
 *  = its transform-origin (the point it grows from — the lips). Poses without an entry render the flat castSrc image. */
export const CAST_LAYERS = {
  // RIOT keeps the can in hand (it's held, so it stays painted in); the SPRAY puff bursts from its nozzle (116,135)
  // HEX: the book floats beside her (pages open at ~(415,235)) — its magic puffs, runes and sparkles play on a timer
  hex: {
    hero: {
      act: 'magic',
      sprites: [
        { src: '/cast/props/spark-big.webp', x: 80, y: 26, w: 12 },
        { src: '/cast/props/spark-sm.webp', x: 70.5, y: 33.5, w: 7 },
        { src: '/cast/props/rune-zig.webp', x: 77, y: 38.5, w: 8 },
        { src: '/cast/props/rune-moon.webp', x: 72.7, y: 37.5, w: 9 },
        { src: '/cast/props/magic-puff.webp', x: 73, y: 37.5, w: 16 },
      ],
    },
  },
  hype: { hero: { act: 'shout', sprites: [
    { src: '/cast/props/shout-arcs.webp', x: 78, y: 36, w: 13, o: '0% 50%' },
    { src: '/cast/props/confetti.webp', x: 19, y: -2, w: 20 },
  ] } },
  brawl: { hero: { act: 'jab', sprites: [
    { src: '/cast/props/impact.webp', x: 70, y: 25.5, w: 20 },
    { src: '/cast/props/sweat.webp', x: 31, y: 20, w: 4.5 },
  ] } },
  'riot-elite': { hero: { act: 'rock', sprites: [
    { src: '/cast/props/note-double.webp', x: 20, y: 48, w: 15 },
    { src: '/cast/props/note.webp', x: 38, y: 44, w: 11 },
    { src: '/cast/props/bolt.webp', x: 83, y: 24, w: 9 },
  ] } },
  'hype-elite': { hero: { act: 'mvp', sprites: [
    { src: '/cast/props/shout-arcs.webp', x: 1, y: 0, w: 13, o: '100% 50%' },
    { src: '/cast/props/confetti.webp', x: 52, y: -3, w: 22 },
    { src: '/cast/props/confetti.webp', x: 30, y: 2, w: 18 },
  ] } },
  'brawl-elite': { hero: { act: 'champ', sprites: [
    { src: '/cast/props/flash.webp', x: 5, y: 13, w: 19 },
    { src: '/cast/props/flash.webp', x: 74, y: 9, w: 18 },
    { src: '/cast/props/flash.webp', x: 78, y: 55, w: 17 },
  ] } },
  'hex-elite': { hero: { act: 'arcane', sprites: [
    { src: '/cast/props/spark-big.webp', x: 6.8, y: 8.2, w: 10 },
    { src: '/cast/props/spark-sm.webp', x: 1, y: 20, w: 6 },
    { src: '/cast/props/rune-zig.webp', x: 82, y: 36, w: 8 },
    { src: '/cast/props/rune-moon.webp', x: 76, y: 34, w: 9 },
    { src: '/cast/props/magic-puff.webp', x: 75, y: 37, w: 15 },
  ] } },
  // GLITCH.EXE: three bands of its own art (a static clip-path) tear sideways
  'glitch-elite': { hero: { act: 'glitch', sprites: [
    { src: '/cast/glitch-elite-hero.webp', x: 0, y: 0, w: 100, clip: 'inset(18% 0 70% 0)' },
    { src: '/cast/glitch-elite-hero.webp', x: 0, y: 0, w: 100, clip: 'inset(46% 0 44% 0)' },
    { src: '/cast/glitch-elite-hero.webp', x: 0, y: 0, w: 100, clip: 'inset(70% 0 21% 0)' },
  ] } },
  riot: {
    hero: {
      act: 'spray',
      sprites: [
        { src: '/cast/props/spray-puff.webp', x: -7.3, y: 11.5, w: 30, o: '100% 54.5%' },
        { src: '/cast/props/spray-puff-sm.webp', x: -15, y: 6, w: 14, o: '100% 60%' },
        { src: '/cast/props/spray-drop.webp', x: 19, y: 24.5, w: 3.6 },
      ],
    },
  },
  glitch: {
    hero: {
      base: '/cast/glitch-hero-base.webp',
      gum: { x: 53.6, y: 41.5, w: 14.6, o: '25% 50%' },
    },
  },
};
export const castLayers = (id, pose = 'hero') => (CAST_LAYERS[id] && CAST_LAYERS[id][pose]) || null;
/** SIGNATURE IDLES (Andy oct17: "not have the same animation EVERYWHERE"): the profile showcase plays each member's own
 *  move — RIOT head-bangs, GLITCH stays bored then skips a frame, HYPE double-hops, BRAWL bobs and weaves, HEX floats.
 *  Still squash-and-stretch from the feet plus small TRANSLATIONS (never a rotation). The podium keeps the quiet
 *  CAST_BEATS breath at half strength; cards stay still (their props / shine carry the life). Keys: [offset, scaleX,
 *  scaleY, x%, y%]. An ELITE plays its member's move. */
export const CAST_IDLE = {
  riot: { ms: 900, rest: 900, k: [[0, 1, 1, 0, 0], [0.16, 1.08, 0.9, 0, 0], [0.34, 0.95, 1.07, 0, -4], [0.5, 1.07, 0.92, 0, 0], [0.68, 0.97, 1.04, 0, -2], [0.84, 1.02, 0.98, 0, 0], [1, 1, 1, 0, 0]] },
  glitch: { ms: 1700, rest: 2200, k: [[0, 1, 1, 0, 0], [0.55, 1.02, 0.98, 0, 0], [0.6, 1.02, 0.98, -3, 0], [0.63, 1.02, 0.98, 2.5, 0], [0.66, 1, 1, -1, 0], [0.69, 1, 1, 0, 0], [1, 1, 1, 0, 0]] },
  hype: { ms: 1150, rest: 700, k: [[0, 1, 1, 0, 0], [0.12, 1.1, 0.88, 0, 0], [0.27, 0.92, 1.1, 0, -9], [0.41, 1.09, 0.89, 0, 0], [0.55, 0.94, 1.07, 0, -6], [0.69, 1.06, 0.94, 0, 0], [0.84, 0.99, 1.02, 0, 0], [1, 1, 1, 0, 0]] },
  brawl: { ms: 1100, rest: 500, k: [[0, 1, 1, 0, 0], [0.22, 1.04, 0.95, -3, 1], [0.45, 1, 1, 0, 0], [0.68, 1.04, 0.95, 3, 1], [0.9, 1, 1, 0, 0], [1, 1, 1, 0, 0]] },
  hex: { ms: 2400, rest: 600, k: [[0, 1, 1, 0, 0], [0.4, 0.98, 1.03, 0, -5], [0.7, 0.99, 1.02, 0, -4], [1, 1, 1, 0, 0]] },
};
for (const e of ELITE) CAST_IDLE[e.id] = CAST_IDLE[e.base];
export const castIdleFrames = (b) => b.k.map(([offset, sx, sy, x, y]) => ({ offset, transform: `translate(${x}%, ${y}%) scale(${sx}, ${sy})` }));
/** The podium's quieter breath: a CAST_BEATS beat at `amp` strength (1 = full). */
export const castBreathFrames = (b, amp = 0.5) => b.k.map(([offset, sx, sy]) => ({ offset, transform: `scale(${(1 + (sx - 1) * amp).toFixed(4)}, ${(1 + (sy - 1) * amp).toFixed(4)})` }));
