// config.js — RUN MODE flags + tunables.
//
// UNLOCK LEVEL — chosen from the economy curve, not guessed. A run draws its rounds
// from the three solo modes; the highest-gated of those is FUSE at LV25. RUN is the
// culmination, so it sits one milestone above, at LV30 — which is also an existing
// progression beat (the TOXIC theme unlocks there, so the menu already treats LV30 as
// a moment). Cumulative XP to each level, from the shipped xp.js need() curve:
//   LV20 (CHAIN)  34,200   ·   LV25 (FUSE) 105,380   ·   LV30 (RUN) 322,620
// So RUN costs ~3× FUSE — a real, earned reward for an invested player, but reachable
// without a rebirth. (Verified: node -e over src/progress/xp.js need().)
export const RUN_UNLOCK_LEVEL = 30;

// Master flag. Off keeps the menu grid at its current five cards and the 'run' view
// unreachable, so shipping is a one-line flip once the play-test signs off.
export const RUN_MODE_ENABLED = true;

// The App view id for the run screen (mirrors CHAIN_VIEW / FUSE_VIEW).
export const RUN_VIEW = 'run';

// The three solo modes a round can roll, with the per-round flavour shown to the
// player. Rounds are scored by the shipped rarity×combo×lucky engine (runMode/engine)
// with the drafted modifiers applied, so every mode shares one comparable score.
export const ROUND_MODES = [
  { key: 'chain', label: 'CHAIN', rule: 'Each word starts where the last ended.', accent: '#2EFFE0' },
  { key: 'fuse', label: 'FUSE', rule: 'Every word must contain the fragment.', accent: '#FFE94A' },
  { key: 'sat', label: 'SAT RUSH', rule: 'Define the word before it fills in.', accent: '#9A1AFF' },
];
