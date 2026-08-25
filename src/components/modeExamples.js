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
  // A real SAT word → its definition.
  'sat-rush': { kind: 'define', word: 'ELOQUENT', definition: 'FLUENT & PERSUASIVE IN SPEECH' },
};

// Typical round length, one short phrase per mode.
export const MODE_ROUND_LENGTH = {
  'word-bomb': 'TURN-BASED',
  'category-blitz': '~60 SECONDS',
  chain: 'SURVIVAL · 1 LIFE',
  fuse: 'SURVIVAL · 3 LIVES',
  'sat-rush': 'SURVIVAL',
};
