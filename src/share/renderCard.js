// src/share/renderCard.js
// Draws the result card onto a DEDICATED 1080x1080 canvas (passed in — never the
// live juice FX canvas). On-brand per DESIGN.md: dark bg + grid + faint graffiti,
// pink TYPE A WORD wordmark, per-mode neon badge pill, hero result, stat chips,
// the hook, the bomb mascot, typeaword.com, and a scannable QR. Static image.

import { SHARE, REF_URL } from './shareConfig';
import { drawQR } from './qr';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // a missing mascot must not break the card
    img.src = src;
  });
}

// Make sure the canvas fonts are actually ready before the first text draw, or
// Bungee falls back to a system font in the PNG.
async function ensureFonts() {
  try {
    if (document.fonts) {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load(`700 120px ${SHARE.fonts.display}`),
        document.fonts.load(`700 36px ${SHARE.fonts.body}`),
      ]).catch(() => {});
    }
  } catch {
    /* fonts API absent — fall back silently */
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderCard(canvas, model) {
  const S = SHARE;
  const W = S.SIZE;
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext('2d');
  await ensureFonts();

  // --- background: flat dark + subtle grid + faint pink graffiti wash ---
  ctx.fillStyle = S.bg;
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = S.grid;
  ctx.lineWidth = 2;
  for (let i = 60; i < W; i += 60) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke();
  }
  ctx.fillStyle = S.graffiti;
  ctx.beginPath(); ctx.arc(W * 0.8, W * 0.18, 220, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.15, W * 0.7, 180, 0, Math.PI * 2); ctx.fill();

  // neon frame
  ctx.strokeStyle = model.neon;
  ctx.lineWidth = 10;
  roundRect(ctx, 24, 24, W - 48, W - 48, 28);
  ctx.stroke();

  ctx.textAlign = 'center';

  // --- wordmark ---
  ctx.fillStyle = S.wordmark;
  ctx.font = `700 64px ${S.fonts.display}`;
  ctx.fillText('TYPE A WORD', W / 2, S.wordmarkY);

  // --- mode badge pill ---
  ctx.font = `700 34px ${S.fonts.display}`;
  const bw = ctx.measureText(model.badge).width + 64;
  ctx.fillStyle = model.neon;
  roundRect(ctx, W / 2 - bw / 2, S.badgeY - 40, bw, 60, 30);
  ctx.fill();
  ctx.fillStyle = S.bg;
  ctx.fillText(model.badge, W / 2, S.badgeY);

  // --- hero (1-2 lines), glow in the mode neon ---
  ctx.save();
  ctx.fillStyle = S.ink;
  ctx.shadowColor = model.neon;
  ctx.shadowBlur = 28;
  const heroLines = String(model.hero).split('\n');
  const heroSize = heroLines.length > 1 || model.hero.length > 9 ? 120 : 168;
  ctx.font = `700 ${heroSize}px ${S.fonts.display}`;
  heroLines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, S.heroY + i * (heroSize + 6) - (heroLines.length - 1) * (heroSize / 2));
  });
  ctx.restore();

  // --- sub line ---
  if (model.sub) {
    ctx.fillStyle = model.sub.includes('RECORD') ? S.wordmark : S.dim;
    ctx.font = `700 44px ${S.fonts.display}`;
    ctx.fillText(model.sub, W / 2, S.subY);
  }

  // --- stat chips (2-3, centered row) ---
  if (model.chips.length) {
    ctx.font = `700 28px ${S.fonts.body}`;
    const gap = 28;
    const chipW = 250;
    const chipH = 110;
    const totalW = model.chips.length * chipW + (model.chips.length - 1) * gap;
    let cx = W / 2 - totalW / 2;
    model.chips.forEach((c) => {
      ctx.fillStyle = S.panel;
      roundRect(ctx, cx, S.chipsY - chipH / 2, chipW, chipH, 14);
      ctx.fill();
      ctx.strokeStyle = model.neon;
      ctx.lineWidth = 3;
      roundRect(ctx, cx, S.chipsY - chipH / 2, chipW, chipH, 14);
      ctx.stroke();
      ctx.fillStyle = model.neon;
      ctx.font = `700 24px ${S.fonts.body}`;
      ctx.fillText(c.label, cx + chipW / 2, S.chipsY - 14);
      ctx.fillStyle = S.ink;
      ctx.font = `700 46px ${S.fonts.display}`;
      ctx.fillText(c.value, cx + chipW / 2, S.chipsY + 34);
      cx += chipW + gap;
    });
  }

  // --- hook ---
  ctx.fillStyle = model.neon;
  ctx.font = `700 52px ${S.fonts.display}`;
  ctx.fillText(S.hook, W / 2, S.hookY);

  // --- url ---
  ctx.fillStyle = S.dim;
  ctx.font = `700 30px ${S.fonts.body}`;
  ctx.textAlign = 'left';
  ctx.fillText(S.url, S.mascot.x + S.mascot.size + 24, W - 96);

  // --- mascot (bottom-left) ---
  const mascot = await loadImage(model.mascotSrc);
  if (mascot) ctx.drawImage(mascot, S.mascot.x, S.mascot.y, S.mascot.size, S.mascot.size);

  // --- scannable QR (bottom-right) to the ?ref=share URL ---
  await drawQR(ctx, REF_URL, S.qr.x, S.qr.y, S.qr.size, { dark: S.bg, light: '#ffffff' });

  return canvas;
}
