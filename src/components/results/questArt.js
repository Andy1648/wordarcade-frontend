// questArt.js — the QUESTS art slots (progression phase 1). CLAUDE.md ART VS MOTION: art is a painted asset, never CSS.
// Phase 1 ships with the house kit standing in (KitStamp's DONE stamp, the kit panel, a flat plate for the nudge) and
// these slots EMPTY. When the painted pieces land (new filenames only — art is immutable-cached, scripts/art-manifest.mjs),
// set the path here and the parade + the quest list switch to the art. Painted nov14 (ChatGPT, one piece per image). The
// card plate and the nudge banner are 9-SLICED (ResultsParade.css border-image): the rivet corners / ribbon ends stay
// at their own ratio and only the plain edges stretch, so neither is ever squashed or cropped.
//
//   card        the quest card plate behind each row / list card     → public/quests/quest-card-v1.webp   (512×178, transparent)
//   doneStamp   the DONE stamp slammed on a finished quest            → public/quests/stamp-done-v1.webp   (512×256, transparent)
//   nudgeBanner the banner behind the "1 MORE GAME FINISHES A QUEST" → public/quests/nudge-banner-v1.webp (1024×128, transparent)
//   weekly      the WEEKLY quest's emblem                             → public/quests/weekly-v1.webp       (256×256, transparent)
export const QUEST_ART = {
  card: '/quests/quest-card-v1.webp',
  doneStamp: '/quests/stamp-done-v1.webp',
  nudgeBanner: '/quests/nudge-banner-v1.webp',
  weekly: '/quests/weekly-v1.webp',
};

// each game's own painted art (the menu card heroes, the cast props, the achievement glyphs) — the CONTRACTS sheet's set
export const MODE_ART = {
  wb: '/cards/wb-hero.webp',
  blitz: '/cards/cb-hero.webp',
  sat: '/cast/props/spellbook.webp',
  chain: '/ach/chain-v1.webp',
  fuse: '/cast/props/bolt.webp',
  race: '/cast/props/spark-big.webp',
  any: '/ach/key-v1.webp',
};
export const MODE_TONE = { wb: 'cyan', blitz: 'hot', sat: 'yellow', chain: 'purple', fuse: 'purple', race: 'pink', any: 'lilac' };
