// gameData.js
// Plain data describing each game on the homepage grid. Keeping this
// separate from the JSX components means adding a 7th game later is a
// one-entry addition here, not a structural change to GameCard.jsx.
//
// `artKey` must match an exported component name in GameArt.jsx -
// GameCard looks it up dynamically rather than each game having its own
// hardcoded SVG inline.

import { SAT_RUSH_ENABLED } from './satRush/config';

const BASE_GAMES = [
  {
    id: 'word-bomb',
    artKey: 'WordBombArt',
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
    name: 'CATEGORY\nBLITZ',
    description: 'AI JUDGES YOUR ANSWERS — GET CREATIVE.',
    baseColor: '#3DA8FF',
    iconBg: '#fff',
    badgeText: 'SOLO/MULTI', // no spaces — matches Word Bomb's badge and fits the pill (fix/qa-sweep §3)
    badgeBg: '#000',
    badgeColor: '#3DA8FF',
    textColor: '#000',
    descColor: '#1a0b2e',
    enabled: true,
    // Drives the compact "AI JUDGED" pill on the card (GameCard.jsx) so it reads
    // as "AI Category Blitz" without touching the big two-line title.
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
  artKey: 'ChainArt',
  name: 'CHAIN',
  description: 'Each word starts where the last one ended',
  unlockLevel: 20, // gated: visible-but-locked until LV 20 (raised from 15 per fix/qa-sweep §9 — ~3420 letters at the current curve; was LV15 ≈ 1088)
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
  artKey: 'FuseArt',
  name: 'FUSE',
  description: 'Type a word that contains the piece',
  unlockLevel: 25, // gated: visible-but-locked until LV 25 (fix/qa-sweep §10 — ~10538 letters; LV30's ~32262 was ~100 sessions, too steep for an existing mode). Was LV22 ≈ 5371.
  baseColor: '#FFE94A', // yellow field (the mode's accent)
  iconBg: '#2A1A0E', // burnt-cord dark so the flame icon reads
  badgeText: 'SOLO',
  badgeBg: '#000',
  badgeColor: '#FFE94A',
  textColor: '#000',
  descColor: '#4A3A10',
  enabled: true,
};

// SAT RUSH (when enabled) keeps slot 3; CHAIN + FUSE are the new slots 4 and 5,
// so the stagger/rotation rules keyed to those slots land on the new cards.
export const GAMES = [
  ...BASE_GAMES,
  ...(SAT_RUSH_ENABLED ? [SAT_RUSH_GAME] : []),
  CHAIN_GAME,
  FUSE_GAME,
];
