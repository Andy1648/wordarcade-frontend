// difficulty.js — the ONE source of truth for Word Bomb's difficulty tiers, shared by the
// lobby (RoomScreen) and the in-game HUD (GameScreen) so they can never disagree.
//
// The `key` is the value the server expects/reports (chill/easy/medium/hard); the `label`
// is the edgy display name (CHILL/HARD/CRAZY/HELL). Before this module the lobby renamed the
// tiers but the in-game chip uppercased the raw key, so picking "CRAZY" showed "MEDIUM"
// mid-game (and "HELL"→"HARD", "HARD"→"EASY"). Both screens now read `difficultyLabel`.
//
// `desc` is the Word Bomb per-turn timer + lives, mirroring the backend DIFFICULTY_PRESETS
// in gameLogic.js (chill 20s/3, HARD 15s/2, CRAZY 10s/2, HELL 7s/2). Category Blitz has no
// difficulty control (its timer is a fixed 20s and rerolls come from a separate prop), so
// there is deliberately no CB variant here.
export const DIFFICULTIES = [
  { key: 'chill', label: 'CHILL', desc: '20s · 3 lives' },
  { key: 'easy', label: 'HARD', desc: '15s · 2 lives' },
  { key: 'medium', label: 'CRAZY', desc: '10s · 2 lives' },
  { key: 'hard', label: 'HELL', desc: '7s · 2 lives' },
];

const BY_KEY = Object.fromEntries(DIFFICULTIES.map((d) => [d.key, d]));

// The display label for a server difficulty key. Unknown/blank falls back to the
// uppercased key so a never-before-seen tier still reads as something.
export function difficultyLabel(key) {
  return BY_KEY[key]?.label ?? String(key || '').toUpperCase();
}

// The tier's timer·lives blurb.
export function difficultyDesc(key) {
  return BY_KEY[key]?.desc ?? '';
}

// Read-only readout for non-hosts: "CRAZY — 10s · 2 lives" (falls back to the bare key).
export function difficultyReadout(key) {
  const m = BY_KEY[key];
  return m ? `${m.label} — ${m.desc}` : String(key || '').toUpperCase();
}
