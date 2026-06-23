// gameData.js
// Plain data describing each game on the homepage grid. Keeping this
// separate from the JSX components means adding a 7th game later is a
// one-entry addition here, not a structural change to GameCard.jsx.
//
// `artKey` must match an exported component name in GameArt.jsx -
// GameCard looks it up dynamically rather than each game having its own
// hardcoded SVG inline.

export const GAMES = [
  {
    id: 'word-bomb',
    artKey: 'WordBombArt',
    name: 'WORD\nBOMB',
    description: 'USE THE COMBO BEFORE TIME RUNS OUT.',
    baseColor: '#2EFFE0',
    iconBg: '#FFE94A',
    badgeText: 'MULTIPLAYER',
    badgeBg: '#000',
    badgeColor: '#2EFFE0',
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
    description: 'NAME THINGS FAST. NO REPEATS.',
    baseColor: '#FF6B3D',
    iconBg: '#fff',
    badgeText: 'SOLO / MULTI',
    badgeBg: '#000',
    badgeColor: '#FF6B3D',
    textColor: '#000',
    descColor: '#1a0b2e',
    enabled: true,
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
