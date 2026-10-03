// modeExamples.js — the WORKED EXAMPLE for each mode (item 2: previews shown, not described).
// Keyed by game.id so both ModeDialog (unlocked) and LockedPreviewDialog (locked) render the
// same real example. Data only; the rendering + highlight colour live in ModeExample.jsx.
export const MODE_EXAMPLES = {
  // Combo → the word that contains it (the combo highlighted).
  'word-bomb': { kind: 'combo', combo: 'TRA', word: 'TRAIN' },
  // Category prompt → a few valid answers.
  'category-blitz': { kind: 'category', prompt: 'FRUITS', answers: ['APPLE', 'MANGO', 'KIWI'] },
  // A chain where each word starts on the previous word's last letter (pivots highlighted).
  chain: { kind: 'chain', words: ['E', 'EAGLE', 'ELEPHANT', 'TIGER'] },
  // A fragment → words that contain it (the fragment highlighted in each).
  fuse: { kind: 'fuse', fragment: 'AIN', answers: ['RAIN', 'AGAIN', 'MOUNTAIN'] },
  // ENTIRE-WORD racing: everyone types the same words, in order (the one you're on highlighted).
  'word-race': { kind: 'words', words: ['HOUSE', 'RIVER', 'MAGIC', 'LATER'] },
  // A real SAT word → its definition.
  'sat-rush': { kind: 'define', word: 'ELOQUENT', definition: 'FLUENT & PERSUASIVE IN SPEECH' },
};

// Typical round length, one short phrase per mode.
export const MODE_ROUND_LENGTH = {
  'word-bomb': 'TURN-BASED',
  'category-blitz': '~60 SECONDS',
  chain: 'SURVIVAL · 1 LIFE',
  // H6: FUSE starts on 2 lives (fuse.js FUSE_START_LIVES) and can earn back up to 3 (FUSE_MAX_LIVES).
  fuse: 'SURVIVAL · 2 LIVES (UP TO 3)',
  'word-race': 'FIRST TO 25 · 1:00 CAP',
  'sat-rush': 'SURVIVAL',
};
