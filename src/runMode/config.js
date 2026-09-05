// config.js — RUN MODE flags + tunables.
//
// UNLOCK LEVEL — moved to the FRONT (was LV30). The original LV30 gate cost ~32,262
// letters ≈ 108 sessions: the game's single most compelling loop sat behind ~three
// months of play, so almost no one ever met it (verdict-2 named this the highest-leverage
// change; the letter count confirmed it). RUN is the REASON to keep playing, not a reward
// for having kept playing — a new player must meet it in their FIRST sitting. LV8 ≈ 189
// letters (well under one session) on the shipped xp.js need() curve. The two solo modes a
// run leans on stay gated as their own content: CHAIN LV20 (~3,420 letters), FUSE LV25
// (~10,538). RUN being reachable before them is intentional — it's the front door, and it
// teaches those modes' rules through its flavoured rounds before you can play them solo.
export const RUN_UNLOCK_LEVEL = 8;

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
