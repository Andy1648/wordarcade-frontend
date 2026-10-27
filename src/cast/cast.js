import { getRebirths, storedLevel } from '../progress/xp.js';
import { heroWins } from './heroWins.js';
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
// NEW FACES (oct17 night, Andy: "more heroes - normal or rarer"): cast members of their own — no seat colour (the five
// above stay the in-game palette, so castFor / castByColor never hand them out), each with its own tier. DUD is earned
// earned with WINS or bought with gems (oct19, HERO_PRICE / HERO_UNLOCK below).
export const NEW_CREW = [
  { id: 'dud', name: 'DUD', tag: 'FUSE ALWAYS OUT', color: '#B8F632', dark: '#6E9A12' },
  { id: 'lexi', name: 'LEXI', tag: "ACTUALLY, IT'S A WORD", color: '#3BA4F9', dark: '#1B5FA8' },
  // oct18 wave 2: SHH (the mime: never says a word, in a word game) and SIZZLE
  { id: 'shh', name: 'SHH', tag: 'SAYS NOTHING. WINS ANYWAY.', color: '#F2F2F5', dark: '#6E6E86' },
  { id: 'sizzle', name: 'SIZZLE', tag: 'TOO HOT TO HANDLE', color: '#D7263D', dark: '#7E0F20' },
  // oct19 wave 3 (Andy: "not to mention making new heros"): QUILL (the dramatic poet) and JINX (the unlucky black cat)
  { id: 'quill', name: 'QUILL', tag: 'SPEAKS ONLY IN VERSE', color: '#8B4DFF', dark: '#3A1580' },
  { id: 'jinx', name: 'JINX', tag: 'NINE LIVES. ZERO LUCK.', color: '#A8F03C', dark: '#1E1A2B' },
  // oct24 (Andy: "cooler heroes"): SALTY, the pirate cannonball — eyepatch, gold tooth, hook, spyglass and cutlass
  { id: 'salty', name: 'SALTY', tag: 'SEVEN SEAS. ZERO MANNERS.', color: '#2D6CDF', dark: '#122E66' },
];
// LEGEND (oct17 night): the rarest tier — a cast member nobody else has, in its own painted LEGEND frame. BOO (the ghost
// of a bomb that already went off) needs REBIRTH 5 and then gems (oct19, HERO_PRICE / HERO_UNLOCK below).
export const LEGEND = [
  { id: 'boo', name: 'BOO', tag: 'ALREADY WENT OFF', color: '#14B8A6', dark: '#0B5F57', legend: true },
  // oct18: MECHA, the chrome robot bomb: REBIRTH 10, then gems
  { id: 'mecha', name: 'MECHA', tag: 'BUILT DIFFERENT', color: '#9FB1C7', dark: '#3E4C63', legend: true },
  // LIMITED (oct21, the hero research: "nothing is limited — every hero is always for sale"): HOLLOW, the jack-o'-lantern
  // bomb, is sold for gems in OCTOBER 2026 ONLY (HOLLOW_UNTIL) and never again. Whoever bought it keeps it forever.
  { id: 'hollow', name: 'HOLLOW', tag: 'OCTOBER ONLY. NEVER AGAIN.', color: '#FF7A1A', dark: '#8A3A00', legend: true, limited: true },
  // oct24 (Andy: "cooler heroes"): NOVA, the cosmic bomb — a night sky for a body, a planet ring, a comet for a fuse.
  // The top of the LEGEND ladder: REBIRTH 15 (the third jackpot rebirth), then gems
  { id: 'nova', name: 'NOVA', tag: 'BIGGER THAN THE SKY', color: '#2EFFE0', dark: '#1A1060', legend: true },
];
/** HOLLOW's sale ends at the start of Nov 1 2026, US Pacific (07:00 UTC). */
export const HOLLOW_UNTIL = Date.UTC(2026, 10, 1, 7, 0, 0);
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
// GOLD (oct18, Andy: "earned GOLD variants (free, ~100 wins with a hero)" — "like shinies", never sold): each crew
// member repainted in polished gold metal (ChatGPT, the HERO attached, same pose, the accessories keep their colours).
// EARNED ONLY: 100 wins (bots + online) with that member equipped (heroWins.js). Same colour / seat / beats / idle as its
// member; only the HERO pose is painted — WIN / KO fall back to the member's own painted poses (castSrc).
export const GOLD_WINS = 100;
export const GOLD = [
  { id: 'riot-gold', base: 'riot', name: 'GOLD RIOT', tag: 'PUNK. BUT SOLID GOLD.' },
  { id: 'glitch-gold', base: 'glitch', name: 'GOLD GLITCH', tag: 'STILL NOT IMPRESSED' },
  { id: 'hype-gold', base: 'hype', name: 'GOLD HYPE', tag: 'GOLD-MEDAL LOUD' },
  { id: 'brawl-gold', base: 'brawl', name: 'GOLD BRAWL', tag: 'HEAVYWEIGHT. LITERALLY.' },
  { id: 'hex-gold', base: 'hex', name: 'GOLD HEX', tag: 'TURNED ITSELF TO GOLD' },
].map((g) => ({ ...CAST.find((c) => c.id === g.base), ...g, gold: true, price: undefined }));
/** A GOLD hero's progress: { have, need, done }. */
export const goldProgress = (id) => {
  const have = heroWins(id);
  return { have: Math.min(have, GOLD_WINS), need: GOLD_WINS, done: have >= GOLD_WINS };
};
// INTERMEDIATE (Andy oct17: "picking 1 or 2 of the 5 to cost gems as well"): two of the crew cost gems — HEX (the
// mystic) and GLITCH (the layered-props showcase); RIOT / HYPE / BRAWL stay free. Anyone already playing one keeps it
// (grandfathered once, readMain).
// oct17 (Andy "we'll def need some more free tiers" … "sure (the 1 rebirth) … 750 is a lot for 1 rebirth"): the two
// priced crew members are EARNED for free — GLITCH at your first rebirth, HEX at level 20 — and the gem price is only a
// shortcut to skip the wait (300). The card shows the requirement over the art (lock + REBIRTH 1 / LEVEL 20).
// oct19 (Andy: "i want dud to cost more gems then lexi and sizzle … all legends to cost gems (more) AND a rebirth
// requirement … dud, lexi, shh, and sizzle can be win requirements but purchasable with diamonds"):
// · DUD / LEXI / SHH / SIZZLE are EARNED free at a WINS count (bots + online, the ACHIEVEMENTS counters) — or gems skip
//   the wait. DUD is the dearest of the four.
// · a LEGEND is never free: it needs its REBIRTH (a `gate` — locked until you reach it) AND its gem price.
// Heroes are looks only: none of this changes how a game plays or pays.
export const HERO_PRICE = { hex: 300, glitch: 300, shh: 500, lexi: 750, sizzle: 750, quill: 900, dud: 1000, jinx: 1300, salty: 1600, hollow: 1500, boo: 7500, mecha: 10000, nova: 12500 };
export const HERO_UNLOCK = { glitch: { reb: 1, label: 'REBIRTH 1', icon: 'rebirth' }, hex: { lv: 20, label: 'LEVEL 20', icon: 'levels' },
  shh: { wins: 40, label: '40 WINS', icon: 'wins' }, lexi: { wins: 60, label: '60 WINS', icon: 'wins' },
  sizzle: { wins: 60, label: '60 WINS', icon: 'wins' }, dud: { wins: 100, label: '100 WINS', icon: 'wins' },
  quill: { wins: 80, label: '80 WINS', icon: 'wins' }, jinx: { wins: 130, label: '130 WINS', icon: 'wins' }, // unlucky 13
  salty: { wins: 160, label: '160 WINS', icon: 'wins' },
  boo: { reb: 5, label: 'REBIRTH 5', icon: 'rebirth', gate: true }, mecha: { reb: 10, label: 'REBIRTH 10', icon: 'rebirth', gate: true },
  nova: { reb: 15, label: 'REBIRTH 15', icon: 'rebirth', gate: true },
  // a LIMITED hero's gate is a DATE: buyable until it, then gone (owners keep it)
  hollow: { until: HOLLOW_UNTIL, label: 'OCTOBER ONLY', gate: true } };
// the ACHIEVEMENTS counters (progress/v3/store.js taw.s2.count) read straight from storage, which keeps the cast data
// free of the progress store import (`mp` = online wins, `bots` = wins against bots)
const counts = () => {
  try { const o = JSON.parse(localStorage.getItem('taw.s2.count') || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
};
const n0 = (v) => Math.max(0, Math.floor(Number(v) || 0));
/** Every win (bots + online) — the WINS requirement's count. */
export const totalWins = () => { const o = counts(); return n0(o.mp) + n0(o.bots); };
/** Earned through play (no gems): the HERO_UNLOCK requirement is met on this save. A LEGEND's rebirth is a gate, never
 *  an earn — it is always bought. */
export function heroEarned(id) {
  const u = HERO_UNLOCK[id];
  if (!u || u.gate) return false;
  try {
    if (u.reb != null && (getRebirths() || 0) >= u.reb) return true;
    if (u.lv != null && (storedLevel() || 1) >= u.lv) return true;
    if (u.wins != null && totalWins() >= u.wins) return true;
  } catch { /* a broken store reads as not yet */ }
  return false;
}
/** Can this hero be bought yet? Only a LEGEND has a gate (its rebirth, or a LIMITED one's sale window); everything else can always be bought. */
/** A LIMITED hero still on sale: whole days left (1+), else null (not limited, or the sale is over). */
export function limitedDaysLeft(id, now = Date.now()) {
  const u = HERO_UNLOCK[id];
  if (!u || u.until == null || now >= u.until) return null;
  return Math.max(1, Math.ceil((u.until - now) / 86400000));
}
export function heroGateMet(id, now = Date.now()) {
  const u = HERO_UNLOCK[id];
  if (!u || !u.gate) return true;
  if (u.until != null) return now < u.until; // LIMITED: on sale until the date, never after
  try { return (getRebirths() || 0) >= u.reb; } catch { return false; }
}
// GRANDFATHERED (oct19, once per save): the old rules handed out BOO at REBIRTH 5, MECHA at REBIRTH 10, DUD at LEVEL 35
// for free (SHH's old 50 online wins already meets its new 40 WINS). Anyone who already met one keeps that hero —
// nobody loses a hero they had.
const RULES_GF_KEY = 'taw.s2.heroes.gf2';
function grandfatherOct19() {
  try {
    if (localStorage.getItem(RULES_GF_KEY)) return;
    localStorage.setItem(RULES_GF_KEY, '1');
    const reb = getRebirths() || 0;
    const keep = [reb >= 5 && 'boo', reb >= 10 && 'mecha', (storedLevel() || 1) >= 35 && 'dud'].filter(Boolean);
    if (!keep.length) return;
    let v = [];
    try { v = JSON.parse(localStorage.getItem(HEROES_KEY) || '[]'); } catch { /* corrupt: start over */ }
    if (!Array.isArray(v)) v = [];
    localStorage.setItem(HEROES_KEY, JSON.stringify([...new Set([...v, ...keep])]));
  } catch { /* blocked storage */ }
}
for (const c of [...CAST, ...NEW_CREW, ...LEGEND]) if (HERO_PRICE[c.id]) c.price = HERO_PRICE[c.id];
export const ALL_HEROES = [...CAST, ...NEW_CREW, ...LEGEND, ...ELITE, ...GOLD];
export const heroById = (id) => ALL_HEROES.find((x) => x.id === id) || null;
// owned ELITE ids — a season-2 progress key (taw.s2.*), so the save backup / cloud save carry it with the gems paid
export const HEROES_KEY = 'taw.s2.heroes';
/** The bought heroes (ELITEs + priced crew), validated. */
export function ownedHeroes() {
  grandfatherOct19();
  try {
    const v = JSON.parse(localStorage.getItem(HEROES_KEY) || '[]');
    return Array.isArray(v) ? v.filter((id) => ALL_HEROES.some((h) => h.id === id && h.price)) : [];
  } catch { return []; }
}
export const ownsHero = (id) => {
  const h = ALL_HEROES.find((x) => x.id === id);
  if (h && h.gold) return goldProgress(id).done; // GOLD is earned with wins only, never bought
  return !!h && (!h.price || heroEarned(id) || ownedHeroes().includes(id));
};
// painted poses that exist in public/cast/ — add `'<id>-<pose>'` as each cut file lands (no 404s, no broken frames)
const PAINTED = new Set([
  'riot-hero', 'glitch-hero', 'hype-hero', 'brawl-hero', 'hex-hero',
  // WIN / KO (oct16, ChatGPT with each HERO attached as the reference — one 2-pose sheet per member, split + cut)
  'riot-win', 'riot-ko', 'glitch-win', 'glitch-ko', 'hype-win', 'hype-ko', 'brawl-win', 'brawl-ko', 'hex-win', 'hex-ko',
  'riot-elite-hero', 'glitch-elite-hero', 'hype-elite-hero', 'brawl-elite-hero', 'hex-elite-hero',
  // ELITE WIN / KO (oct17, ChatGPT with each ELITE HERO attached — one 2-pose sheet per member)
  'riot-elite-win', 'riot-elite-ko', 'glitch-elite-win', 'glitch-elite-ko', 'hype-elite-win', 'hype-elite-ko', 'brawl-elite-win', 'brawl-elite-ko',
  'hex-elite-win', 'hex-elite-ko',
  // NEW FACES (oct17 night, ChatGPT with RIOT's HERO attached as the style reference)
  'dud-hero', 'dud-win', 'dud-ko', 'lexi-hero', 'lexi-win', 'lexi-ko', 'boo-hero', 'boo-win', 'boo-ko',
  'shh-hero', 'shh-win', 'shh-ko', 'sizzle-hero', 'sizzle-win', 'sizzle-ko', 'mecha-hero', 'mecha-win', 'mecha-ko',
  'quill-hero', 'quill-win', 'quill-ko', 'jinx-hero', 'jinx-win', 'jinx-ko',
  'hollow-hero', 'hollow-win', 'hollow-ko', // oct21 LIMITED (ChatGPT, RIOT + BOO as the style refs)
  'salty-hero', 'salty-win', 'salty-ko', // oct24 (ChatGPT, RIOT / JINX / DUD as the style refs)
  'nova-hero', 'nova-win', 'nova-ko', // oct24 LEGEND (ChatGPT, RIOT / JINX / DUD as the style refs)
  // GOLD (oct18, HERO only)
  'riot-gold-hero', 'glitch-gold-hero', 'hype-gold-hero', 'brawl-gold-hero', 'hex-gold-hero',
]);
/** The image for a cast member's pose ('hero' | 'win' | 'ko'). */
export function castSrc(id, pose = 'hero') {
  const c = heroById(id) || CAST[0];
  if (PAINTED.has(`${c.id}-${pose}`)) return `/cast/${c.id}-${pose}.webp`;
  // (oct19 Andy: "all the gold versions have the basic versions of win and k.o." — a GOLD no longer borrows its member's
  // WIN / KO; until its own are painted it shows its gold HERO, below — the caller may tip it over for a K.O.)
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
  dud: { ms: 2600, k: [[0, 1, 1], [0.45, 0.97, 1.04], [0.8, 1.04, 0.96], [1, 1, 1]] }, // one deep, sleepy breath
  lexi: { ms: 1000, k: [[0, 1, 1], [0.35, 0.96, 1.05], [0.65, 1.02, 0.98], [1, 1, 1]] }, // a prim little rise
  boo: { ms: 2200, k: [[0, 1, 1], [0.5, 0.97, 1.04], [1, 1, 1]] }, // a ghost's slow swell (it has no feet to bounce on)
  shh: { ms: 1400, k: [[0, 1, 1], [0.4, 1.02, 0.98], [0.75, 0.99, 1.02], [1, 1, 1]] }, // a hushed, careful breath
  sizzle: { ms: 640, k: [[0, 1, 1], [0.25, 1.06, 0.94], [0.5, 0.96, 1.05], [0.75, 1.03, 0.97], [1, 1, 1]] }, // hot and jumpy
  quill: { ms: 1300, k: [[0, 1, 1], [0.4, 0.97, 1.04], [0.75, 1.02, 0.98], [1, 1, 1]] }, // a theatrical inhale
  jinx: { ms: 900, k: [[0, 1, 1], [0.3, 1.05, 0.94], [0.6, 0.97, 1.03], [1, 1, 1]] }, // a cat's twitchy settle
  salty: { ms: 1100, k: [[0, 1, 1], [0.35, 1.04, 0.95], [0.7, 0.98, 1.03], [1, 1, 1]] }, // a sea-legs sway, heavy iron
  mecha: { ms: 1200, k: [[0, 1, 1], [0.2, 1.04, 0.96], [0.4, 1.04, 0.96], [0.7, 0.98, 1.02], [1, 1, 1]] }, // a heavy hydraulic settle
  nova: { ms: 2400, k: [[0, 1, 1], [0.5, 0.98, 1.03], [1, 1, 1]] }, // a slow orbit's breath (it floats; nothing to bounce on)
};
for (const e of [...ELITE, ...GOLD]) CAST_BEATS[e.id] = CAST_BEATS[e.base]; // an ELITE / GOLD keeps its member's tempo
export const castBeatFrames = (b) => b.k.map(([offset, sx, sy]) => ({ offset, transform: `scale(${sx}, ${sy})` }));
/** PROP SLOTS (oct17 night, the layered-props plan step 2): RIOT / HYPE / BRAWL / HEX are painted PROP-LESS (`base`,
 *  ChatGPT with the HERO attached: same pose, the prop removed) and their signature prop rides on top as a `slots` sprite
 *  — the can, the foam finger, the gloves, the spellbook — so a slot can later take a different prop. HYPE / BRAWL / HEX
 *  props were cut as the pixel difference between the painted HERO and its registered base (exact fit); RIOT's base
 *  holds an empty fist and its can is its own sprite drawn UNDER the body so the fingers wrap it. `?props=0` shows the
 *  bare bodies. Boxes are % of the 512 pose square like every other sprite. */
/** LAYERED PROPS (oct16 pilot — GLITCH's gum; handoff "props as separate pieces"): a pose can be painted PROP-LESS
 *  (`base`) with each prop its own sprite, placed at a per-pose anchor so it can animate on its own (the gum inflates
 *  and pops) without moving the body. Boxes are % of the 512 pose square: x/y/w = the sprite's top-left + width; `o`
 *  = its transform-origin (the point it grows from — the lips). Poses without an entry render the flat castSrc image. */
export const CAST_LAYERS = {
  // RIOT's SPRAY puff bursts from the can's nozzle (~21%, 30% since the can became a slot under the empty fist)
  // HEX: the book floats beside her (pages open at ~(415,235)) — its magic puffs, runes and sparkles play on a timer
  hex: {
    hero: {
      base: '/cast/hex-hero-base.webp',
      slots: [{ slot: 'hand', src: '/cast/props/spellbook.webp', x: 63.67, y: 41.02, w: 29.88 }],
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
  hype: { hero: { base: '/cast/hype-hero-base.webp', slots: [{ slot: 'hand', src: '/cast/props/foam-finger.webp', x: 11.33, y: 3.12, w: 28.52 }], act: 'shout', sprites: [
    { src: '/cast/props/shout-arcs.webp', x: 78, y: 36, w: 13, o: '0% 50%' },
    { src: '/cast/props/confetti.webp', x: 19, y: -2, w: 20 },
  ] } },
  brawl: { hero: { base: '/cast/brawl-hero-base.webp', slots: [{ slot: 'hands', src: '/cast/props/gloves.webp', x: 12.3, y: 28.91, w: 75.39 }], act: 'jab', sprites: [
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
      base: '/cast/riot-hero-base.webp',
      // the can sits BEHIND the empty fist (under the body), so the fingers wrap it
      slots: [{ slot: 'hand', src: '/cast/props/spray-can.webp', x: 3, y: 28, w: 36, under: true }],
      act: 'spray',
      sprites: [
        { src: '/cast/props/spray-puff.webp', x: -8.9, y: 15.1, w: 30, o: '100% 54.5%' },
        { src: '/cast/props/spray-puff-sm.webp', x: -16.6, y: 9.6, w: 14, o: '100% 60%' },
        { src: '/cast/props/spray-drop.webp', x: 17.4, y: 28.1, w: 3.6 },
      ],
    },
  },
  // DUD snores: three Z's drift up off the nightcap, small to big
  dud: { hero: { act: 'snore', sprites: [
    { src: '/cast/props/sleep-z.webp', x: 75, y: 17, w: 10 },
    { src: '/cast/props/sleep-z.webp', x: 80, y: 5, w: 12.5 },
    { src: '/cast/props/sleep-z.webp', x: 85, y: -8, w: 14.5 },
  ] } },
  // LEXI: "well, ACTUALLY" — a lightbulb pops over the raised finger, a page flutters out of the dictionary
  lexi: { hero: { act: 'eureka', sprites: [
    { src: '/cast/props/bulb.webp', x: 70, y: 6, w: 22, o: '50% 100%' },
    { src: '/cast/props/page.webp', x: 2, y: 33, w: 16 },
  ] } },
  // BOO haunts: ghost-smoke wisps curl off its tail, teal ghost-fire embers lift off the fuse
  boo: { hero: { act: 'haunt', sprites: [
    { src: '/cast/props/ghost-wisp.webp', x: 57, y: 69, w: 18, o: '0% 60%' },
    { src: '/cast/props/ghost-wisp.webp', x: 20, y: 61, w: 14, o: '100% 60%' },
    { src: '/cast/props/ghost-ember.webp', x: 71, y: 0, w: 7 },
    { src: '/cast/props/ghost-ember.webp', x: 62, y: 5, w: 5.5 },
  ] } },
  // SHH: a "..." bubble pops out beside the raised palm; it has something to say and doesn't say it
  shh: { hero: { act: 'mime', sprites: [
    { src: '/cast/props/mime-bubble.webp', x: 68, y: 3, w: 27, o: '0% 100%' },
  ] } },
  // SIZZLE: the fuse flares, hot sauce spits from the bottle, steam lifts off its head
  sizzle: { hero: { act: 'sear', sprites: [
    { src: '/cast/props/flame.webp', x: 74, y: 1, w: 22, o: '50% 100%' },
    { src: '/cast/props/sauce-drop.webp', x: 13, y: 11, w: 7 },
    { src: '/cast/props/sauce-drop.webp', x: 19, y: 9, w: 6 },
    { src: '/cast/props/steam.webp', x: 30, y: 18, w: 14 },
  ] } },
  // MECHA (oct19, Andy: "mecha - it just doesn't really fit … QUALITY"): a machine, idling — the fuse burns steady over
  // its painted flame, both boot thrusters flicker sideways out of their nozzles and cough exhaust, the antenna beacon
  // double-blinks, a glint scans across the visor. Anchors are measured off mecha-hero.webp (fuse tip ~(212,86), jets
  // ~(131,408) / (410,412), bulb ~(348,64)); a flame's `o` is its base, so it flickers out of the nozzle, never off it.
  mecha: { hero: { act: 'boost', sprites: [
    { src: '/cast/props/flame.webp', x: 33.4, y: 1.8, w: 16, o: '50% 94%' },
    { src: '/cast/props/flame.webp', x: 20, y: 69.1, w: 11, o: '50% 94%' },
    { src: '/cast/props/flame.webp', x: 74.5, y: 70, w: 11, o: '50% 94%' },
    { src: '/cast/props/steam.webp', x: 12.1, y: 74.6, w: 7 },
    { src: '/cast/props/steam.webp', x: 86.7, y: 75.6, w: 7 },
    { src: '/cast/props/spark-sm.webp', x: 64.9, y: 9.5, w: 6 },
    { src: '/cast/props/spark-sm.webp', x: 46.5, y: 31.5, w: 5 },
    { src: '/cast/props/spark-sm.webp', x: 62.9, y: 32.2, w: 5 },
  ] } },
  glitch: {
    hero: {
      base: '/cast/glitch-hero-base.webp',
      gum: { x: 53.6, y: 41.5, w: 14.6, o: '25% 50%' },
    },
  },
};
// GOLD poses have their props painted in (one flat image), so they take the member's prop ACT only — no prop-less base,
// no slots. RIOT's spray rides the can where the painted HERO holds it (its pre-slot nozzle, ~(116,135)); GLITCH's gum
// is part of the gold paint, so GOLD GLITCH stays flat.
const goldAct = (base, sprites) => ({ hero: { act: CAST_LAYERS[base].hero.act, sprites: sprites || CAST_LAYERS[base].hero.sprites } });
CAST_LAYERS['riot-gold'] = goldAct('riot', [
  { src: '/cast/props/spray-puff.webp', x: -7.3, y: 11.5, w: 30, o: '100% 54.5%' },
  { src: '/cast/props/spray-puff-sm.webp', x: -15, y: 6, w: 14, o: '100% 60%' },
  { src: '/cast/props/spray-drop.webp', x: 19, y: 24.5, w: 3.6 },
]);
for (const b of ['hype', 'brawl', 'hex']) CAST_LAYERS[`${b}-gold`] = goldAct(b);
/** PAINTED FRAME ANIMATION (oct19, Andy: "more quality and diverse animations (that prob also arent css generated so you
 *  can use chatgpt or gemini)"): a hero can have a hand-drawn FLIPBOOK — ChatGPT frames of the same character on one
 *  sheet, cut + registered on the feet (public/cast/anim/<id>-<n>.webp) — that CastArt flips through like a Flash
 *  timeline (hard frame swaps, no tweening). `seq` = [frame, ms] steps from the resting frame 0 back to it; `rest` = the
 *  hold on frame 0 before the next play. While a hero has frames its painted HERO + prop streams are replaced by them. */
// 12 FRAMES (oct24, Andy: "the quality and addictiveness of the heros would be much bigger if they were in smoother
// motion"): every 6-frame idle got 6 painted IN-BETWEENS (ChatGPT, the hero's own sheet attached; frame 6 + k sits halfway
// between frames k and k+1, frame 11 between 5 and 0), registered on frame 0's feet and checked one by one. Each step a→b
// now passes through its middle for ~40% of b's hold (same routine, same length). A rejected in-between (it drew a prop
// on the wrong hand: MECHA 6, NOVA 9) is never shown — that step keeps its old hard swap.
export const CAST_FRAMES = {
  // RIOT: shake the can (twice), spray, blow the nozzle like a smoking gun
  // 6 frames (oct19, Andy: "a bit too choppy"): cocks the can → shakes it (twice) → aims, a first puff → full spray → blows the nozzle
  // 12 frames (oct24, Andy: "the quality and addictiveness of the heros would be much bigger if they were in smoother
  // motion"): frames 6-11 are painted IN-BETWEENS (ChatGPT, the 6-frame sheet attached, each halfway between two of its
  // frames: 6 = 0→1, 7 = 1→2, 8 = 2→3, 9 = 3→4, 10 = 4→5, 11 = 5→0), so every old step now passes through its middle
  riot: { n: 12, seq: [[6, 70], [1, 70], [7, 75], [2, 75], [7, 60], [1, 60], [7, 80], [2, 80], [8, 150], [3, 150], [9, 380], [4, 380], [10, 490], [5, 490], [11, 200]], rest: 1500 },
  // GLITCH: bored chew → the bubble grows → huge → POP, gum all over its face, still unimpressed
  // 6 frames: chew → the bubble grows (fist → head → HUGE) → POP → gum peeled half off, deadpan
  glitch: { n: 12, seq: [[6, 120], [1, 180], [7, 128], [2, 192], [8, 208], [3, 312], [9, 152], [4, 228], [10, 480], [5, 504], [11, 216]], rest: 2000 },
  // HYPE: wind up → finger to the sky YELLING → wave it to the crowd (twice) → points right at you, wink
  // 6 frames: finger up → YELL → swings it across, tongue out → back down → points right at you, wink
  hype: { n: 12, seq: [[6, 64], [1, 96], [7, 208], [2, 312], [8, 136], [3, 204], [9, 104], [4, 156], [10, 360], [5, 378], [11, 162]], rest: 1600 },
  // BRAWL: guard up → jab jab → big uppercut → gloves bumped, cocky wink
  // 6 frames: guard → jab half → jab full (twice) → winds low → UPPERCUT → gloves bumped, wink
  brawl: { n: 12, seq: [[6, 40], [1, 50], [7, 64], [2, 96], [7, 40], [1, 50], [6, 56], [0, 84], [6, 40], [1, 50], [7, 64], [2, 96], [8, 104], [3, 156], [9, 280], [4, 420], [10, 380], [5, 399], [11, 171]], rest: 1600 },
  // HEX: reading → looks up, fingers wiggling stars → the book FLARES, eyes glowing → snaps it shut, 'shh'
  // 6 frames: reading → looks up, a first star → fingers wiggle stars → the book FLARES → snaps shut → 'shh'
  hex: { n: 12, seq: [[6, 144], [1, 216], [7, 208], [2, 312], [8, 328], [3, 492], [9, 144], [4, 216], [10, 440], [5, 462], [11, 198]], rest: 1900 },
  // BOO: sneaky grin → peeks through its fingers (twice) → arms wide, the big spook → doubled over laughing
  // 6 frames: sneaky grin → hands rise → peeks through its fingers → hands drop → the big SPOOK → doubled over laughing
  boo: { n: 12, seq: [[6, 120], [1, 180], [7, 248], [2, 372], [8, 88], [3, 132], [9, 320], [4, 480], [10, 400], [5, 420], [11, 180]], rest: 1800 },
  // MECHA (oct21 repaint, Andy "what happened to its cool shooting arms?" — the old frame 3 carried a clipped fist from the
  // next cell): ready → the arm-cannon whirs → ROCKET PUNCH (the fist flies, flame trail, inside its cell) → flies back →
  // re-docks with a spark + shoulder steam → thumbs up ^ ^
  mecha: { n: 12, seq: [[1, 380], [7, 184], [2, 276], [8, 120], [3, 180], [9, 224], [4, 336], [10, 400], [5, 420], [11, 180]], rest: 1800 },
  // DUD: asleep → snot bubble swells → POP, jolts awake → giant yawn
  // 6 frames: asleep → head droops, bubble swells → POP, jolts awake → giant yawn → snuggles back down
  dud: { n: 12, seq: [[6, 208], [1, 312], [7, 320], [2, 480], [8, 208], [3, 312], [9, 288], [4, 432], [10, 240], [5, 252], [11, 108]], rest: 2200 },
  // LEXI: finger raised → pushes the glasses up, *glint* → book open, lecturing → hugs the book, smug
  // 6 frames: finger up → to the glasses → push up, *glint* → book swung open → taps the page, lecturing → hugs it, smug
  lexi: { n: 12, seq: [[6, 104], [1, 156], [7, 248], [2, 372], [8, 168], [3, 252], [9, 312], [4, 468], [10, 400], [5, 420], [11, 180]], rest: 1900 },
  // SHH: finger to lips → the invisible wall → the invisible rope → a smug bow
  // 6 frames: finger to lips → palms up → the invisible WALL → slides along it → the invisible rope → a smug bow
  shh: { n: 12, seq: [[6, 104], [1, 156], [7, 248], [2, 372], [8, 208], [3, 312], [9, 248], [4, 372], [10, 400], [5, 420], [11, 180]], rest: 1900 },
  // SIZZLE: thumbs up → a big swig → breathes FIRE, hat flies → sweating, still grinning
  // 6 frames: thumbs up → tips the bottle → a big swig → cheeks puff, eyes water → breathes FIRE, hat flies → sweating, grinning
  sizzle: { n: 12, seq: [[6, 104], [1, 156], [7, 208], [2, 312], [8, 184], [3, 276], [9, 320], [4, 480], [10, 400], [5, 420], [11, 180]], rest: 1800 },
  // HOLLOW (oct24, the LIMITED hero finally moves): flicks the candy corn up → watches it fall → CHOMP, cheeks bulging →
  // chews, the carved face glowing, the fuse flaring → an evil cackle, fists up
  hollow: { n: 12, seq: [[6, 128], [1, 192], [7, 168], [2, 252], [8, 224], [3, 336], [9, 304], [4, 456], [10, 400], [5, 420], [11, 180]], rest: 1800 },
  // 6-FRAME loops (oct19, Andy: "we can add in more frames bc currently its a bit too choppy"): a 3x2 wide sheet = six
  // full-res frames, each a small step from the last, so the beats flow instead of jumping
  // QUILL recites: breath in → unrolls the scroll → arm swept wide → quill flourish → rolls it up, a smug little bow
  quill: { n: 12, seq: [[6, 88], [1, 132], [7, 104], [2, 156], [8, 208], [3, 312], [9, 168], [4, 252], [10, 184], [5, 193], [11, 83]], rest: 1700 },
  // JINX: admires the mirror shard → it CRACKS → fur puffs, tail bottle-brushed, HISS → licks a paw, over it → smug
  jinx: { n: 12, seq: [[6, 168], [1, 252], [7, 104], [2, 156], [8, 280], [3, 420], [9, 208], [4, 312], [10, 168], [5, 176], [11, 76]], rest: 1600 },
  // SALTY: spyglass up → spots something → lowers it, gold tooth glint → whips out the cutlass → points it at you → rests it
  // on the shoulder, wink
  salty: { n: 12, seq: [[6, 168], [1, 252], [7, 208], [2, 312], [8, 104], [3, 156], [9, 280], [4, 420], [10, 400], [5, 420], [11, 180]], rest: 1800 },
  // NOVA (LEGEND): flicks its tiny star up → it bursts into a crown of five stars → a finger snap, the ring tilts → the
  // stars fall into its palm as a tiny ringed planet → holds it up, comet flaring
  // oct26: in-between 9 repainted (the snap hand lowering as the planet forms — the old one drew a prop on the wrong hand)
  nova: { n: 12, seq: [[6, 152], [1, 228], [7, 304], [2, 456], [8, 120], [3, 180], [9, 248], [4, 372], [10, 440], [5, 462], [11, 198]], rest: 2000 },
  // ELITE / GOLD versions (oct19, Andy: "the confetti for hype ... it's so css we need to do better"): their own painted
  // flipbooks replace the prop streams too
  // MVP HYPE: megaphone down → YELLS into it → fists up, a painted confetti burst → thumb at the crown, wink
  // 6 frames (oct26, the ELITE idles were 4-frame jumps): megaphone down → swings it up → YELLS → flung high, a confetti
  // burst → thumb at the crown, wink → lowers it, the last confetti falling
  'hype-elite': { n: 6, seq: [[1, 220], [2, 700], [3, 1000], [4, 700], [5, 400]], rest: 1600 },
  // ROCKSTAR RIOT: horns up → strums (twice), notes fly → windmill + headbang, sparks off the guitar → rock-god pose
  // 6 frames: horns up → strums → strums harder, notes fly (twice) → windmill headbang, sparks → guitar high, tongue out → lowers it
  'riot-elite': { n: 6, seq: [[1, 220], [2, 220], [1, 180], [2, 220], [3, 900], [4, 1000], [5, 300]], rest: 1500 },
  // CHAMP BRAWL: guard → jab → hoists the BELT, camera flashes → kisses the glove at you
  // 6 frames: guard → jab (twice) → reaches for the belt → hoists it, camera flashes → lowers it → kisses the glove, a heart
  'brawl-elite': { n: 6, seq: [[1, 160], [0, 140], [1, 160], [2, 300], [3, 1100], [4, 300], [5, 900]], rest: 1500 },
  // GLITCH.EXE: bored hologram → types, code floats up → the whole body GLITCHES (sliced + pixels) → arms crossed, smug
  // 6 frames: bored, a hologram keyboard → types, code floats up → types faster → the body GLITCHES (twice) → snaps back → arms crossed
  'glitch-elite': { n: 6, seq: [[1, 500], [2, 500], [3, 160], [4, 120], [3, 300], [4, 300], [5, 1200]], rest: 1800 },
  // ARCHMAGE HEX: leans on the staff → crystal flares → a swirl of runes + stars bursts out → calm, smug
  // 6 frames: leans on the staff → raises it, the crystal glows → it FLARES, eyes gold → a swirl of runes + stars → fades → smug
  'hex-elite': { n: 6, seq: [[1, 500], [2, 700], [3, 1050], [4, 500], [5, 900]], rest: 1800 },
};
// GOLD versions act out their member's routine in solid gold — 6 painted frames each (oct26 repaint: the 4-frame
// GOLD sheets jumped between poses), small steps so the beats flow
const GOLD_SEQ6 = {
  riot: { n: 6, seq: [[1, 170], [2, 170], [1, 170], [2, 170], [3, 250], [4, 950], [5, 800]], rest: 1600 }, // shakes the can (twice) → a first puff → full spray → blows the nozzle
  glitch: { n: 6, seq: [[1, 380], [2, 420], [3, 700], [4, 260], [5, 900]], rest: 2000 }, // the gum bubble grows, grows, HUGE → POP on its face → peels it off
  hype: { n: 6, seq: [[1, 220], [2, 420], [3, 300], [4, 300], [5, 900]], rest: 1700 }, // the foam finger up → YELLS → swings it across and back → points at you, wink
  brawl: { n: 6, seq: [[1, 90], [2, 160], [1, 90], [2, 160], [3, 250], [4, 650], [5, 800]], rest: 1600 }, // jab (twice) → winds low → UPPERCUT → gloves bumped, wink
  hex: { n: 6, seq: [[1, 450], [2, 500], [3, 950], [4, 300], [5, 900]], rest: 1900 }, // looks up, a star → fingers wiggle stars → the book FLARES → snaps it shut → 'shh'
};
for (const b of ['riot', 'glitch', 'hype', 'brawl', 'hex']) CAST_FRAMES[`${b}-gold`] = GOLD_SEQ6[b];
/** WIN flipbooks (oct19, Andy: "theres so much hero stuff we can improve on"): the victory pose acts out a short
 *  celebration on the results screen, the preview's WIN tab and the NEW HERO reveal. Frames are
 *  public/cast/anim/<id>-win-<n>.webp, registered on the pose's lowest point (the WIN poses are mid-jump). */
export const CAST_WIN_FRAMES = {};
// each spec carries its file prefix; built ONCE here so a component's effect deps stay stable across re-renders
const FRAME_SPECS = { hero: {}, win: {}, ko: {} };
for (const [id, F] of Object.entries(CAST_FRAMES)) FRAME_SPECS.hero[id] = { ...F, file: id };
export function registerWinFrames(id, F) { CAST_WIN_FRAMES[id] = F; FRAME_SPECS.win[id] = { ...F, file: `${id}-win` }; }
// a WIN celebration runs tighter than an idle: short holds, a short rest — it's a party
// 6-frame WIN sheets (3x2): small steps, so the party flows
const WIN_SEQ6 = { n: 6, seq: [[1, 260], [2, 420], [3, 420], [4, 520], [5, 900]], rest: 600 };
registerWinFrames('riot', WIN_SEQ6); // oct26 repaint (was 4 frames, fuse unlit): crouch → fists up → the hop, a pink spray splash → shakes the can → points it at you → rock-on horns
registerWinFrames('glitch', WIN_SEQ6);
registerWinFrames('hype', WIN_SEQ6);
registerWinFrames('brawl', WIN_SEQ6);
registerWinFrames('hex', WIN_SEQ6);
registerWinFrames('sizzle', WIN_SEQ6);
registerWinFrames('boo', WIN_SEQ6);
registerWinFrames('mecha', WIN_SEQ6);
registerWinFrames('dud', WIN_SEQ6);
registerWinFrames('lexi', WIN_SEQ6);
registerWinFrames('shh', WIN_SEQ6);
registerWinFrames('jinx', WIN_SEQ6);
registerWinFrames('salty', WIN_SEQ6); // lands → leans on the cutlass → the treasure chest → over its head → hook salute
registerWinFrames('nova', WIN_SEQ6); // rises, the shooting star curls round → a spin → a clap of stars → points at you → arms crossed
registerWinFrames('hollow', WIN_SEQ6); // lands crouched → fists up → the hop, fuse flares, candy corn bursts → cackles → catches a candy corn, points at you → arms crossed
registerWinFrames('quill', WIN_SEQ6); // oct26 repaint (was 4 frames): hand on heart → reads the verse → arm to the sky, cape out → the bow → tosses you a rose → the smug nod
// ELITE WIN flipbooks (oct26 — they showed a still): ChatGPT, each ELITE's WIN + standing pose attached
registerWinFrames('riot-elite', WIN_SEQ6); // lands, guitar low → guitar high, horns → a power chord mid-air, sparks + confetti → a wild strum → knee-slide, points it at you → guitar on the shoulder
registerWinFrames('glitch-elite', WIN_SEQ6); // crouched → fist up under a hologram grid → glitches into slices mid-air → snaps back, a download bar fills → finger-guns → arms crossed
registerWinFrames('hype-elite', WIN_SEQ6); // lands → megaphone high → the wings flap, a confetti burst → YELLS into it → points it at you, wink → thumb at the crown
registerWinFrames('brawl-elite', WIN_SEQ6); // boxing crouch → hoists the belt → camera flashes mid-air → a roaring double fist pump → points at you, belt on the shoulder → gloves crossed
registerWinFrames('hex-elite', WIN_SEQ6); // lands → staff high, the crystal glows → floats in a swirl of runes → the book flips itself → a star at you, wink → leans on the staff
/** K.O. flipbooks (oct26, Andy: "use [ChatGPT] on HEROES first … KO flipbooks"): the knocked-out hero on the results
 *  screen acts out a short loop of trying to get back up and failing (frame 0 = the painted K.O. pose, the last frame
 *  lands back on it). Frames are public/cast/anim/<id>-ko-<n>.webp, registered on the lowest point like the WIN frames. */
export const CAST_KO_FRAMES = {};
export function registerKoFrames(id, F) { CAST_KO_FRAMES[id] = F; FRAME_SPECS.ko[id] = { ...F, file: `${id}-ko` }; }
// a K.O. loop lies still a beat, stirs, tries, fails — slower than a WIN, and it rests long on the floor
const KO_SEQ6 = { n: 6, seq: [[1, 300], [2, 450], [3, 600], [4, 260], [5, 700]], rest: 900 };
registerKoFrames('riot', KO_SEQ6); // an eye blinks open → sits up, dizzy stars → props on a glove, fist up → the arm gives out → flat again
registerKoFrames('glitch', KO_SEQ6); // a bored eye opens → lifts its head, stars → props up, blows a HUGE gum bubble → POP, gum on its face, flops
registerKoFrames('hype', KO_SEQ6); // an eye opens → the foam finger up, weak → a hoarse little cheer → the finger droops and bonks it, flops
registerKoFrames('brawl', KO_SEQ6); // a boot twitches → sits up, stars → up on one knee, a weak jab → the jab spins it, topples
registerKoFrames('hex', KO_SEQ6); // an eye opens, hat askew → lifts its head, stars → reaches for the spellbook → a sad fizzle in its face, flops
registerKoFrames('dud', KO_SEQ6); // standing, KO'd by sleep: nods off → a snot bubble swells → POP, jolts awake, nightcap flies → a giant teary yawn
registerKoFrames('lexi', KO_SEQ6); // staggering: glasses slide down → bends for the book → reads it upside down → it SNAPS shut on its nose
registerKoFrames('boo', KO_SEQ6); // floating, X eyes: the tail droops → deflates like a sad balloon → flat on the floor, one eye peeks → puffs back up, woozy
registerKoFrames('shh', KO_SEQ6); // trapped in the invisible box: palms on the glass → it shrinks → squeezed tiny, beret pops off → slides down the wall
registerKoFrames('sizzle', KO_SEQ6); // tongue on fire: fans its mouth → grabs the hot sauce → a panicked swig → breathes a puff of fire, crying
registerKoFrames('mecha', KO_SEQ6); // sparks → powers down, slumped → dark visor, smoke → REBOOT, loading bars → X eyes again
// QUILL's sheet opened on a happy reading pose, so its last (K.O.) frame is frame 0 and the loop runs five
registerKoFrames('quill', { n: 5, seq: [[1, 300], [2, 450], [3, 600], [4, 700]], rest: 900 }); // an eye opens → stars → reads a verse aloud → the scroll smacks its face
registerKoFrames('jinx', KO_SEQ6); // the tail twitches → stars + halo → admires itself in a mirror shard → it CRACKS, fur puffs up
registerKoFrames('hollow', KO_SEQ6); // an eye glows back on → reaches for a candy corn → to its mouth → it slips and bonks its head
registerKoFrames('salty', KO_SEQ6); // face-down: a boot twitches → lifts its head, stars → the spyglass, wrong way round → face-plants in the dust
registerKoFrames('nova', KO_SEQ6); // planets drift round → a dazed eye → tries to lift its ring back up → the ring clonks its head
// ELITE K.O. flipbooks (oct26): each ELITE's K.O. + standing pose attached
registerKoFrames('riot-elite', KO_SEQ6); // an eye opens → grabs the guitar → one sad strum → a string snaps in its face, flops
registerKoFrames('glitch-elite', KO_SEQ6); // crashed → a loading spinner → the visor flickers on, a loading bar → nearly loaded → the bar goes red and shatters, glitches out
registerKoFrames('hype-elite', KO_SEQ6); // an eye opens → grabs the megaphone → a big breath → only a tiny squeak, flops
registerKoFrames('brawl-elite', KO_SEQ6); // a glove twitches → onto one knee → staggers up, a wobbly guard → the belt slips to its ankles and trips it
registerKoFrames('hex-elite', KO_SEQ6); // under its hat: peeks out → grabs the staff → a few weak sparkles → the spell backfires in its face
export const castFrames = (id, pose = 'hero') => (FRAME_SPECS[pose] && FRAME_SPECS[pose][id]) || null;
export const castLayers = (id, pose = 'hero') => (CAST_LAYERS[id] && CAST_LAYERS[id][pose]) || null;
/** SIGNATURE IDLES (Andy oct17: "not have the same animation EVERYWHERE"): the profile showcase plays each member's own
 *  move — RIOT head-bangs, GLITCH stays bored then skips a frame, HYPE double-hops, BRAWL bobs and weaves, HEX floats.
 *  Still squash-and-stretch from the feet plus small TRANSLATIONS (never a rotation). The podium keeps the quiet
 *  CAST_BEATS breath at half strength; cards stay still (their props / shine carry the life). Keys: [offset, scaleX,
 *  scaleY, x%, y%]. An ELITE plays its member's move. */
export const CAST_IDLE = {
  riot: { ms: 1300, rest: 0, k: [[0, 1, 1, 0, 0], [0.16, 1.08, 0.9, 0, 0], [0.34, 0.95, 1.07, 0, -4], [0.5, 1.07, 0.92, 0, 0], [0.68, 0.97, 1.04, 0, -2], [0.84, 1.02, 0.98, 0, 0], [1, 1, 1, 0, 0]] },
  glitch: { ms: 2460, rest: 0, k: [[0, 1, 1, 0, 0], [0.55, 1.02, 0.98, 0, 0], [0.6, 1.02, 0.98, -3, 0], [0.63, 1.02, 0.98, 2.5, 0], [0.66, 1, 1, -1, 0], [0.69, 1, 1, 0, 0], [1, 1, 1, 0, 0]] },
  hype: { ms: 1670, rest: 0, k: [[0, 1, 1, 0, 0], [0.12, 1.1, 0.88, 0, 0], [0.27, 0.92, 1.1, 0, -9], [0.41, 1.09, 0.89, 0, 0], [0.55, 0.94, 1.07, 0, -6], [0.69, 1.06, 0.94, 0, 0], [0.84, 0.99, 1.02, 0, 0], [1, 1, 1, 0, 0]] },
  brawl: { ms: 1600, rest: 0, k: [[0, 1, 1, 0, 0], [0.22, 1.04, 0.95, -3, 1], [0.45, 1, 1, 0, 0], [0.68, 1.04, 0.95, 3, 1], [0.9, 1, 1, 0, 0], [1, 1, 1, 0, 0]] },
  hex: { ms: 3480, rest: 0, k: [[0, 1, 1, 0, 0], [0.4, 0.98, 1.03, 0, -5], [0.7, 0.99, 1.02, 0, -4], [1, 1, 1, 0, 0]] },
  // DUD nods off — a slow sag forward and down, then a snap awake (the jolt), and it settles back
  dud: { ms: 3600, rest: 0, k: [[0, 1, 1, 0, 0], [0.5, 1.05, 0.94, 1.5, 3], [0.62, 1.06, 0.93, 2, 4], [0.66, 0.94, 1.08, 0, -4], [0.76, 1.02, 0.98, 0, 0], [1, 1, 1, 0, 0]] },
  // LEXI clears its throat — up on its toes ("well, ACTUALLY"), two short prim nods
  // BOO hovers, then JUMP-SCARES: shrinks back and down, lunges big at you, and drifts back to its hover
  boo: { ms: 3000, rest: 0, k: [[0, 1, 1, 0, 0], [0.3, 1, 1, 0, -5], [0.55, 1, 1, 0, 0], [0.66, 0.9, 0.9, 0, 3], [0.72, 1.14, 1.14, 0, -3], [0.8, 1.1, 1.1, 0, -3], [1, 1, 1, 0, 0]] },
  // SHH mimes the invisible wall: slides one way, stops dead (palm on the glass), then the other way
  shh: { ms: 2600, rest: 0, k: [[0, 1, 1, 0, 0], [0.2, 1, 1, -3, 0], [0.24, 1.03, 0.97, -3, 0], [0.45, 1, 1, -3, 0], [0.65, 1, 1, 3, 0], [0.69, 1.03, 0.97, 3, 0], [0.88, 1, 1, 3, 0], [1, 1, 1, 0, 0]] },
  // SIZZLE can't stand still: a quick hot shiver, then a hop off the burner
  sizzle: { ms: 1500, rest: 0, k: [[0, 1, 1, 0, 0], [0.08, 1, 1, -1.5, 0], [0.16, 1, 1, 1.5, 0], [0.24, 1, 1, -1.5, 0], [0.32, 1, 1, 0, 0], [0.45, 1.08, 0.9, 0, 0], [0.6, 0.94, 1.08, 0, -7], [0.78, 1.05, 0.95, 0, 0], [1, 1, 1, 0, 0]] },
  // MECHA powers up: the hydraulics squat, the jets lift it, it hangs, then lands heavy
  mecha: { ms: 2600, rest: 0, k: [[0, 1, 1, 0, 0], [0.18, 1.06, 0.93, 0, 1], [0.38, 0.97, 1.04, 0, -6], [0.62, 0.97, 1.04, 0, -6], [0.78, 1.08, 0.92, 0, 1], [0.9, 0.99, 1.01, 0, 0], [1, 1, 1, 0, 0]] },
  // NOVA drifts: a slow rise and settle above its halo, never touching down
  nova: { ms: 3200, rest: 0, k: [[0, 1, 1, 0, 0], [0.5, 1, 1, 0, -4], [1, 1, 1, 0, 0]] },
  quill: { ms: 2600, rest: 0, k: [[0, 1, 1, 0, 0], [0.3, 0.97, 1.04, 0, -3], [0.6, 1, 1, 0, -3], [0.8, 1.02, 0.98, 0, 0], [1, 1, 1, 0, 0]] },
  salty: { ms: 2200, rest: 0, k: [[0, 1, 1, 0, 0], [0.25, 1.03, 0.97, -2, 0], [0.5, 1, 1, 0, 0], [0.75, 1.03, 0.97, 2, 0], [1, 1, 1, 0, 0]] },
  jinx: { ms: 2000, rest: 0, k: [[0, 1, 1, 0, 0], [0.2, 1.04, 0.95, 0, 1], [0.35, 0.96, 1.05, 0, -4], [0.5, 1, 1, 0, 0], [1, 1, 1, 0, 0]] },
  lexi: { ms: 1900, rest: 0, k: [[0, 1, 1, 0, 0], [0.18, 0.95, 1.07, 0, -4], [0.36, 0.95, 1.07, 0, -4], [0.48, 1.04, 0.96, 0, 0], [0.6, 1, 1, 0, -1.5], [0.72, 1.04, 0.96, 0, 0], [0.86, 1, 1, 0, 0], [1, 1, 1, 0, 0]] },
};
for (const e of [...ELITE, ...GOLD]) CAST_IDLE[e.id] = CAST_IDLE[e.base];
export const castIdleFrames = (b) => b.k.map(([offset, sx, sy, x, y]) => ({ offset, transform: `translate(${x}%, ${y}%) scale(${sx}, ${sy})` }));
/** The podium's quieter breath: a CAST_BEATS beat at `amp` strength (1 = full). */
export const castBreathFrames = (b, amp = 0.5) => b.k.map(([offset, sx, sy]) => ({ offset, transform: `scale(${(1 + (sx - 1) * amp).toFixed(4)}, ${(1 + (sy - 1) * amp).toFixed(4)})` }));
