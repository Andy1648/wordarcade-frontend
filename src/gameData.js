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
    id: 'more-soon',
    artKey: 'MoreSoonArt',
    name: 'MORE\nSOON',
    description: 'NEW GAMES LOADING SOON.',
    baseColor: '#1a0b2e',
    iconBg: '#0d0618',
    iconBorderColor: '#2EFFE0',
    badgeText: 'COMING SOON',
    badgeBg: '#0d0618',
    badgeColor: '#2EFFE0',
    badgeBorderColor: '#2EFFE0',
    textColor: '#2EFFE0',
    descColor: '#C9B8E8',
    dashedBorder: true,
    enabled: false,
  },
];
