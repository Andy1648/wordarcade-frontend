// dailyBlitz/shareImage.js — the DAILY BLITZ share card as a PNG (1080x1080), for the native share sheet /
// a saved image. Spoiler-free like the text: the day, one square per prompt in its rarity colour, the score,
// the streak, the link — never a category or an answer. The one piece of art is the Category Blitz brain
// (real PNG art, /cards/cb-hero.webp); everything else is type and flat squares on the house palette.
import { PROMPTS, MAX_POINTS, shareLink } from './engine.js';
import { formatNum } from '../format.js';

const W = 1080;
const H = 1080;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function strokeText(ctx, text, x, y, fill, stroke = 12) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** Render the card; resolves to a PNG Blob (or null where canvas is unavailable). */
export async function renderShareImage({ dayNumber, rows = [], total = 0, streak = 0, origin } = {}) {
  if (typeof document === 'undefined') return null;
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([document.fonts.load('80px Bungee'), document.fonts.load('700 40px "Space Mono"')]);
    }
  } catch {
    /* fonts unavailable — the fallback face still draws */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // the page + one panel (flat fills, a coloured outline, the hard black offset shadow)
  ctx.fillStyle = '#0d0618';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';
  ctx.fillRect(84, 84, 936, 936);
  ctx.fillStyle = '#1a0b2e';
  ctx.fillRect(60, 60, 936, 936);
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#1f6fc4';
  ctx.strokeRect(66, 66, 924, 924);

  const brain = await loadImage('/cards/cb-hero.webp');
  if (brain) ctx.drawImage(brain, 700, 96, 260, 390);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '400 64px Bungee, Impact, sans-serif';
  strokeText(ctx, 'TYPE A WORD', 120, 200, '#FF4FA3');
  ctx.font = '400 92px Bungee, Impact, sans-serif';
  strokeText(ctx, 'DAILY', 120, 320, '#3DA8FF', 14);
  strokeText(ctx, 'BLITZ', 120, 420, '#3DA8FF', 14);
  ctx.font = '700 44px "Space Mono", monospace';
  ctx.fillStyle = '#FFE94A';
  ctx.fillText(`#${dayNumber}`, 124, 490);

  // the squares
  const size = 118;
  const gap = 20;
  const x0 = (W - (PROMPTS * size + (PROMPTS - 1) * gap)) / 2;
  for (let i = 0; i < PROMPTS; i++) {
    const r = rows[i];
    const x = x0 + i * (size + gap);
    const y = 560;
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8, y + 8, size, size);
    ctx.fillStyle = r && r.band ? r.band.color : '#3a2a52';
    ctx.fillRect(x, y, size, size);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);
  }

  ctx.textAlign = 'center';
  ctx.font = '400 120px Bungee, Impact, sans-serif';
  strokeText(ctx, formatNum(total), W / 2 - 60, 840, '#fff', 16);
  ctx.font = '400 56px Bungee, Impact, sans-serif';
  ctx.textAlign = 'left';
  const scoreW = (() => { ctx.font = '400 120px Bungee, Impact, sans-serif'; return ctx.measureText(formatNum(total)).width; })();
  ctx.font = '400 56px Bungee, Impact, sans-serif';
  strokeText(ctx, `/${PROMPTS * MAX_POINTS}`, W / 2 - 60 + scoreW / 2 + 10, 840, '#9fc8ff', 10);

  ctx.textAlign = 'center';
  ctx.font = '700 38px "Space Mono", monospace';
  ctx.fillStyle = '#FF6B3D';
  if (streak >= 2) ctx.fillText(`${streak}-DAY STREAK`, W / 2, 900);
  ctx.fillStyle = '#2EFFE0';
  ctx.fillText(shareLink(origin).replace(/^https?:\/\//, '').replace(/\?.*$/, ''), W / 2, 960);

  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
