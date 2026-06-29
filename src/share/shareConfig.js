// src/share/shareConfig.js
// All copy / colors / layout numbers for the shareable result card live here.
// The card is a static 1080x1080 PNG rendered on a DEDICATED offscreen canvas
// (never the live juice FX canvas). Presentational + read-only.

// The ONE growth URL — on the card, in the QR, and in every share/copy text — so
// PostHog can attribute share-driven visits via the ?ref=share param.
export const REF_URL = 'https://typeaword.com/?ref=share';

export const SHARE = {
  SIZE: 1080, // square card, good for IG/X/most platforms

  // Brand palette (DESIGN.md). Dark bg, pink wordmark, per-mode neon accents.
  bg: '#0d0618',
  panel: '#1a0b2e',
  grid: 'rgba(255,255,255,0.04)',
  graffiti: 'rgba(255,46,196,0.05)',
  ink: '#ffffff',
  wordmark: '#FF2EC4',
  dim: 'rgba(255,255,255,0.62)',

  // Per-mode neon (matches gameData.js + the menu cards).
  modes: {
    'word-bomb': { badge: 'WORD BOMB', neon: '#2EFFE0', mascot: '/mascot-celebrate.png', mascotLoss: '/mascot-panic.png' },
    'category-blitz': { badge: 'CATEGORY BLITZ', neon: '#FF6B3D', mascot: '/mascot-celebrate.png', mascotLoss: '/mascot-idle.png' },
    'imposter-word': { badge: 'IMPOSTER WORD', neon: '#9A1AFF', mascot: '/mascot-taunt.png', mascotLoss: '/mascot-idle.png' },
  },
  defaultMode: { badge: 'TYPE A WORD', neon: '#FFE94A', mascot: '/mascot-idle.png', mascotLoss: '/mascot-idle.png' },

  // Layout (in card px). Centered column.
  pad: 72,
  wordmarkY: 150,
  badgeY: 250,
  heroY: 470,
  subY: 600,
  chipsY: 720,
  hookY: 880,
  qr: { size: 150, x: 1080 - 72 - 150, y: 1080 - 72 - 150 },
  mascot: { size: 230, x: 60, y: 1080 - 60 - 230 },

  hook: 'CAN YOU BEAT THIS?',
  url: 'typeaword.com',
  fonts: { display: 'Bungee', body: '"Space Mono", monospace' },
};
