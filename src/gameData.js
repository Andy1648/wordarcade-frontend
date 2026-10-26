// gameData.js
// Plain data describing each game on the homepage grid. Keeping this
// separate from the JSX components means adding a 7th game later is a
// one-entry addition here, not a structural change to GameCard.jsx.
//
// `artKey` (cards without painted `artLayers`) must match an exported component name in GameArt.jsx -
// GameCard looks it up dynamically rather than each game having its own
// hardcoded SVG inline.

// Extension included ON PURPOSE. Vite resolves either form, node's ESM loader does not — and
// without it this module (the single source of truth for the menu grid) cannot be loaded by
// `node --test`, which is the repo's unit runner. See gameData.test.js.
import { SAT_RUSH_ENABLED } from './satRush/config.js';
import { WORD_RACE_ENABLED } from './race/config.js';

const BASE_GAMES = [
  {
    id: 'word-bomb',
    artKey: 'WordBombArt',
    // Andy oct14 art run: the painted card (public/cards/wb-*.webp) replaces the code-drawn scene
    artLayers: { bg: '/cards/wb-bg.webp', hero: '/cards/wb-hero.webp', fx: '/cards/wb-fx.webp' },
    name: 'WORD\nBOMB',
    description: 'USE THE LETTERS BEFORE TIME RUNS OUT.',
    baseColor: '#FF6B3D',
    iconBg: '#FFE94A',
    badgeText: 'SOLO/MULTI',
    badgeBg: '#000',
    badgeColor: '#FF6B3D',
    textColor: '#000',
    descColor: '#1a0b2e',
    enabled: true,
    // The flagship game - GameCard gives it a "FEATURED" sticker and a
    // straighter, heavier-shadowed treatment so it stands out from the crowd.
    featured: true,
  },
  {
    id: 'category-blitz',
    artKey: 'CategoryBlitzArt',
    // Andy oct14 art run: the painted card — the brain + buzzer stand higher (the buzzer is at the art's bottom)
    artLayers: { bg: '/cards/cb-bg.webp', hero: '/cards/cb-hero.webp', fx: '/cards/cb-fx.webp', heroY: '-19%', heroScale: 0.7 },
    name: 'CATEGORY\nBLITZ',
    // THE CARD SAYS "BLITZ". `name` stays the full title — it is what the mode dialog shows
    // and what the card's aria-label reads out, and neither is width-constrained. The CARD is:
    // at 390x844 its name box is 80px and "CATEGORY" needs 97px at the size every other card's
    // name gets, so this one card was set 8px smaller than the rest at every width (14.2 vs
    // 22.3 at 390, 12 vs 16 at 360) purely because its longest word is longer. Shorter word,
    // same size as its neighbours. Nothing else reads cardName; id/routes/SEO are untouched.
    // Andy oct14 "category blitz only says blitz on game card": the card shows the full CATEGORY / BLITZ again (the
    // card's name fit shrinks the longer word to fit, like any long name)
    description: 'EVERY CATEGORY HAS ITS TOP ANSWERS. HIT ONE, IT SCORES.',
    baseColor: '#3DA8FF',
    iconBg: '#fff',
    badgeText: 'SOLO/MULTI', // no spaces — matches Word Bomb's badge and fits the pill (fix/qa-sweep §3)
    badgeBg: '#000',
    badgeColor: '#3DA8FF',
    textColor: '#000',
    descColor: '#1a0b2e',
    enabled: true,
    // Drives the compact "AI BUILT" ribbon on the card (GameCard.jsx): the category lists were built
    // with AI; scoring is list-only (STEP 9) — no AI judges an answer.
    aiJudged: true,
  },
];

// SAT RUSH — the solo vocab mode. Only appears on the menu when the mode flag is
// on (SAT_RUSH_ENABLED); until it ships the grid stays exactly the two social
// games. The card is a MANGA cover — off-white paper, black ink, ONE spot colour
// (violet, on the in-art multiplier only) — so it reads as a different KIND of
// thing next to the three saturated neon cards. The mode inside stays violet.
const SAT_RUSH_GAME = {
  id: 'sat-rush',
  artKey: 'SatRushArt',
  name: 'SAT\nRUSH',
  description: 'SAT VOCAB, ARCADE SPEED. SOLO.',
  baseColor: '#F2EFE7', // off-white paper (not pure white — that reads disabled)
  iconBg: '#F2EFE7',
  badgeText: 'SOLO',
  badgeBg: '#111', // inverted badge: black fill, cream text
  badgeColor: '#F2EFE7',
  textColor: '#111', // "SAT RUSH" in solid black ink
  descColor: '#333',
  enabled: true,
  // Scarcity framing: a red-ink "LIMITED" stamp (its manga --redink), so the mono card
  // still earns a second look next to the three neon games.
  limited: true,
};

// CHAIN + FUSE — the two solo word modes, previously dark-launched behind
// ?chain=1 / ?fuse=1 (src/solo/config.js). Their cards route straight into the
// mode (no room/WebSocket), exactly like SAT RUSH. Field colour = each mode's
// in-game accent (CHAIN teal, FUSE yellow); the card art is drawn with the
// house 4px black outline.
const CHAIN_GAME = {
  id: 'chain',
  // Andy oct24 "redesign chain and fuse game cards" — the painted, COMPONENT card: the vault backdrop, the chain-link
  // brawler, hover FX, and PARTS for its act (cardLayers/cardActs.js ACTS.chain): the lasso whips, the vault flash
  // blows out where the chain snapped, two broken links fly off. Parts sit in card % (centre x / y, width).
  artLayers: {
    bg: '/cards/ch-bg.webp', hero: '/cards/ch-hero.webp', fx: '/cards/ch-fx.webp', heroY: '-9%', heroScale: 0.74,
    act: 'chain',
    parts: [
      { id: 'flash', src: '/cards/ch-flash.webp', x: 49, y: 19, w: 58, under: true },
      { id: 'link', src: '/cards/ch-link.webp', x: 40, y: 22, w: 28 },
      { id: 'link2', src: '/cards/ch-link.webp', x: 60, y: 20, w: 24 },
    ],
  },
  name: 'CHAIN',
  description: "EACH WORD STARTS ON THE LAST ONE'S LETTER.",
  // LOWERED 20 -> 2 (was 15 before 150a885 raised it). The LV15->20 / LV22->25 raise was
  // pacing set by feel, with no players to pace against; 150a885's own message flagged FUSE's
  // jump as "a ~6x jump — flagged" and then walked it back from 30 to 25. None of that
  // reasoning survives contact with an acquisition push: a gate measured in thousands of typed
  // letters is a wall in front of a first session, not a reward curve. CHAIN and FUSE are now
  // reachable inside the first couple of games — see FUSE below and progress/modeAccess.js.
  // Andy oct9: EXACTLY LV25 (was LV50, N1 oct2) — Andy's number, not a sim estimate. A mode you've played is
  // never locked again (progress/modeAccess.js), so nobody who already plays CHAIN loses it.
  // This is the ONE source: every "UNLOCKS AT LV n" (GameCard, LockedPreviewDialog, MobileMenu) reads it.
  unlockLevel: 25,
  baseColor: '#2EFFE0', // teal field (the mode's accent)
  iconBg: '#0D2B28', // dark teal so the cyan link icon reads
  badgeText: 'SOLO',
  badgeBg: '#000',
  badgeColor: '#2EFFE0',
  textColor: '#000',
  descColor: '#0A3B34',
  enabled: true,
};
const FUSE_GAME = {
  id: 'fuse',
  // Andy oct24: the painted, COMPONENT card — the fireworks storeroom, the sneaky firecracker (shh), hover FX, and
  // PARTS for its act (ACTS.fuse): a tiptoe two-step, the fuse FLARES (flash + spark) and coughs a smoke puff. The
  // pieces ride the hero's frame (onHero), placed on its fuse tip.
  artLayers: {
    bg: '/cards/fu-bg.webp', hero: '/cards/fu-hero.webp', fx: '/cards/fu-fx.webp', heroY: '-4%', heroScale: 0.66,
    act: 'fuse',
    parts: [
      { id: 'flash', src: '/cards/fu-flash.webp', x: 72.6, y: 6, w: 44, onHero: true },
      { id: 'spark', src: '/cards/fu-spark.webp', x: 73, y: 5, w: 30, onHero: true },
      { id: 'smoke', src: '/cards/fu-smoke.webp', x: 68, y: 9, w: 24, onHero: true },
    ],
  },
  name: 'FUSE',
  description: 'SNEAK THE LETTERS INTO A WORD. BEAT THE FUSE.',
  unlockLevel: 50, // Andy oct9: EXACTLY LV50 (was LV100, N1 oct2) — Andy's number. Played = never locked (modeAccess.js).
  baseColor: '#FFE94A', // yellow field (the mode's accent)
  iconBg: '#2A1A0E', // burnt-cord dark so the flame icon reads
  badgeText: 'SOLO',
  badgeBg: '#000',
  badgeColor: '#FFE94A',
  textColor: '#000',
  descColor: '#4A3A10',
  enabled: true,
};

// WORD RACE — 2-5 racers type the SAME sequence of whole words (Andy oct2 A6: entire-word racing,
// monkeytype / TypeRacer style), first to 25. DARK-LAUNCHED
// behind ?race=1 (race/config.js) until the backend's word-race type is deployed: with the flag
// off this array — and so the menu — is exactly what it was.
const WORD_RACE_GAME = {
  id: 'word-race',
  artKey: 'WordRaceArt',
  name: 'WORD\nRACE',
  cardName: 'RACE',
  description: 'SAME WORDS FOR EVERYONE. FIRST TO 25.', // H6: not "25 WINS" (the currency)
  baseColor: '#FF4FA3',
  iconBg: '#1a0b2e',
  badgeText: 'MULTI',
  badgeBg: '#000',
  badgeColor: '#FF4FA3',
  textColor: '#000',
  descColor: '#1a0b2e',
  enabled: true,
};

// SAT RUSH (when enabled) keeps slot 3; CHAIN + FUSE are the new slots 4 and 5,
// so the stagger/rotation rules keyed to those slots land on the new cards.
export const GAMES = [
  ...BASE_GAMES,
  ...(SAT_RUSH_ENABLED ? [SAT_RUSH_GAME] : []),
  CHAIN_GAME,
  FUSE_GAME,
  ...(WORD_RACE_ENABLED ? [WORD_RACE_GAME] : []),
];

// THE FEATURED MODE, DERIVED — the same flag GameCard reads to draw the ribbon, so the menu
// cannot point at one card and quote another. The XP-bar hint under the bar ("N WORDS TO LEVEL
// n") divides by THIS mode's per-word rate: it used to divide by the MENU's, which is x1 and
// therefore the slowest rate in the game, so the first progression number a new player ever saw
// was the worst one available — quoted directly under a card advertising twice it.
// Falls back to the first enabled game if the flag is ever dropped, so the hint degrades to a
// real mode's rate rather than silently back to the menu's.
export const FEATURED_GAME =
  GAMES.find((g) => g.featured && g.enabled) || GAMES.find((g) => g.enabled) || GAMES[0];

// "N MORE MODES" in a run-over offer — derived from the real menu, never a hardcoded number, so
// adding or flag-gating a mode can't leave the copy lying. (Minus the one you just played.)
// Lives here, not in a screen, so CHAIN/FUSE (SoloShell) and SAT RUSH (SatRushResults) can't drift.
export const MORE_MODES = Math.max(1, GAMES.length - 1);
