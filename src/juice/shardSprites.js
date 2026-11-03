// juice/shardSprites.js — the PAINTED accept particles (nov3): the shared particle canvas (particles.js) draws the painted
// crystal shards (public/fx/shards) instead of flat squares, for every particle whose colour is one of the house hues.
// PURE: no DOM — which set a colour paints as, and the sprite list to load. particles.js owns the loading + drawing.
//
//   house pink / red / magenta -> pink · cyan / teal / blue -> cyan · yellow / orange -> gold · purple / violet -> violet
//   anything else (white, grey, ink, paper — SAT RUSH's retro print, a white flash fleck) stays a flat square
export const SPRITE_SETS = ['pink', 'cyan', 'gold', 'violet'];
export const SPRITE_PIECES = 4;
// a painted shard reads bigger than a square of the same "size": the drawn box is size × SPRITE_SCALE
export const SPRITE_SCALE = 2.4;
// the pre-scaled canvas a sprite is drawn from (device px) — big enough for the largest particle at DPR 2
export const SPRITE_PX = 64;

export const spriteUrl = (set, i) => `/fx/shards/${set}-${i % SPRITE_PIECES}.webp`;

/** '#rrggbb' / '#rgb' -> [h (0-360), s (0-1), l (0-1)], or null for anything else. */
export function hsl(hex) {
  if (typeof hex !== 'string') return null;
  let m = /^#([0-9a-f]{3})$/i.exec(hex);
  let r; let g; let b;
  if (m) [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16) / 255);
  else {
    m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return null;
    [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16) / 255);
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

/** The painted set a particle colour draws as, or null (keep the flat square). */
export function setForColor(hex) {
  const c = hsl(hex);
  if (!c) return null;
  const [h, s, l] = c;
  if (s < 0.45 || l < 0.2 || l > 0.9) return null; // greys, ink, paper, white
  if (h >= 285 || h < 10) return 'pink';
  if (h < 70) return 'gold';
  if (h < 250) return 'cyan';
  return 'violet';
}
