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
    description: 'USE THE COMBO BEFORE TIME RUNS OUT.',
    baseColor: '#FF6B3D',
    iconBg: '#FFE94A',
    badgeText: 'SOLO · MULTI',
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
    badgeText: 'SOLO / MULTI',
    badgeBg: '#000',
    badgeColor: '#3DA8FF',
    textColor: '#000',
    descColor: '#1a0b2e',
    enabled: true,
    // Drives the compact "AI JUDGED" pill on the card (GameCard.jsx) so it reads
    // as "AI Category Blitz" without touching the big two-line title.
    aiJudged: true,
  },
  {
    id: 'imposter-word',
    artKey: 'ImposterWordArt',
    name: 'IMPOSTER\nWORD',
    description: 'ONE PLAYER IS FAKE. FIND THEM.',
    baseColor: '#9A1AFF',
    iconBg: '#fff',
    badgeText: 'MULTIPLAYER',
    badgeBg: '#000',
    badgeColor: '#9A1AFF',
    textColor: '#000',
    descColor: '#1a0b2e',
    enabled: true,
  },
];

// SAT RUSH — the solo vocab mode. Only appears on the menu when the mode flag is
// on (SAT_RUSH_ENABLED); until it ships the grid stays exactly the three social
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
};

export const GAMES = SAT_RUSH_ENABLED ? [...BASE_GAMES, SAT_RUSH_GAME] : BASE_GAMES;
