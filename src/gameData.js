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
    // THE CARD SAYS "BLITZ". `name` stays the full title — it is what the mode dialog shows
    // and what the card's aria-label reads out, and neither is width-constrained. The CARD is:
    // at 390x844 its name box is 80px and "CATEGORY" needs 97px at the size every other card's
    // name gets, so this one card was set 8px smaller than the rest at every width (14.2 vs
    // 22.3 at 390, 12 vs 16 at 360) purely because its longest word is longer. Shorter word,
    // same size as its neighbours. Nothing else reads cardName; id/routes/SEO are untouched.
    cardName: 'BLITZ',
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
  description: "EACH WORD STARTS ON THE LAST ONE'S LETTER.",
  // LOWERED 20 -> 2 (was 15 before 150a885 raised it). The LV15->20 / LV22->25 raise was
  // pacing set by feel, with no players to pace against; 150a885's own message flagged FUSE's
  // jump as "a ~6x jump — flagged" and then walked it back from 30 to 25. None of that
  // reasoning survives contact with an acquisition push: a gate measured in thousands of typed
  // letters is a wall in front of a first session, not a reward curve. CHAIN and FUSE are now
  // reachable inside the first couple of games — see FUSE below and progress/modeAccess.js.
  unlockLevel: 2,
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
  description: 'SNEAK THE LETTERS INTO A WORD. BEAT THE FUSE.',
  unlockLevel: 3, // LOWERED 25 -> 3 — same finding as CHAIN above (150a885 set 25 by feel, pre-players).
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

// "N MORE MODES" in a run-over offer — derived from the real menu, never a hardcoded number, so
// adding or flag-gating a mode can't leave the copy lying. (Minus the one you just played.)
// Lives here, not in a screen, so CHAIN/FUSE (SoloShell) and SAT RUSH (SatRushResults) can't drift.
export const MORE_MODES = Math.max(1, GAMES.length - 1);
