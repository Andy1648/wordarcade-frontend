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

  // THE RUN layout (fix/hierarchy) is BANKED-led and keeps every text line clear of the mascot's
  // fixed bottom-left box: lines that share its rows are centred in the band between that box
  // and the QR. Spec sizes are design px at half scale; the 1080 canvas draws them ×2.
  const isRun = model.heroStyle === 'banked';
  const mascotBox = isRun ? S.runMascot : S.mascot;
  const bandL = mascotBox.x + mascotBox.size + 24;
  const bandR = S.qr.x - 24;
  const bandC = (bandL + bandR) / 2;
  const bandW = bandR - bandL;
  // Shrink a font size until `text` fits `maxW` (never below `min`).
  const fit = (text, size, maxW, min = 18) => {
    let s = size;
    ctx.font = `700 ${s}px ${S.fonts.display}`;
    while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = `700 ${s}px ${S.fonts.display}`; }
    return s;
  };

  // --- hero (1-2 lines), glow in the mode neon — or THE RUN's yellow outlined BANKED number ---
  ctx.save();
  if (isRun) {
    const size = fit(String(model.hero), 112, W - 2 * S.pad, 64);
    ctx.font = `700 ${size}px ${S.fonts.display}`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 12;
    ctx.strokeText(String(model.hero), W / 2, S.heroY);
    ctx.fillStyle = '#FFE94A';
    ctx.fillText(String(model.hero), W / 2, S.heroY);
  } else {
    ctx.fillStyle = S.ink;
    ctx.shadowColor = model.neon;
    ctx.shadowBlur = 28;
    const heroLines = String(model.hero).split('\n');
    const heroSize = heroLines.length > 1 || model.hero.length > 9 ? 120 : 168;
    ctx.font = `700 ${heroSize}px ${S.fonts.display}`;
    heroLines.forEach((ln, i) => {
      ctx.fillText(ln, W / 2, S.heroY + i * (heroSize + 6) - (heroLines.length - 1) * (heroSize / 2));
    });
  }
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

  // --- THE RUN's hand: up to four modifier icons in the chip row (feat/run-share) ---
  if (model.icons && model.icons.length) {
    const size = 128;
    const gap = 26;
    const n = Math.min(4, model.icons.length);
    const totalW = n * size + (n - 1) * gap;
    let ix = W / 2 - totalW / 2;
    const imgs = await Promise.all(model.icons.slice(0, n).map(loadImage));
    for (const img of imgs) {
      ctx.fillStyle = S.panel;
      roundRect(ctx, ix, S.chipsY - size / 2, size, size, 16);
      ctx.fill();
      if (img) {
        ctx.save();
        roundRect(ctx, ix, S.chipsY - size / 2, size, size, 16);
        ctx.clip();
        ctx.drawImage(img, ix, S.chipsY - size / 2, size, size);
        ctx.restore();
      }
      ctx.strokeStyle = model.neon;
      ctx.lineWidth = 4;
      roundRect(ctx, ix, S.chipsY - size / 2, size, size, 16);
      ctx.stroke();
      ix += size + gap;
    }
  }

  // --- THE RUN's glyph row: one flat square per round (🟩 clear / 🟨 squeak / ⬛ dead), drawn as
  //     shapes (never font emoji — a PNG can't depend on the viewer's emoji font) ---
  if (model.glyphs && model.glyphs.length) {
    const n = model.glyphs.length;
    const size = n > 10 ? 56 : 64;
    const gap = 14;
    const totalW = n * size + (n - 1) * gap;
    let gx = W / 2 - totalW / 2;
    const top = S.runGlyphY - size / 2;
    const fillOf = { clear: '#3DDC84', squeak: '#FFE94A', dead: '#0d0618' };
    for (const g of model.glyphs) {
      ctx.fillStyle = fillOf[g] || fillOf.dead;
      roundRect(ctx, gx, top, size, size, 10);
      ctx.fill();
      ctx.strokeStyle = g === 'dead' ? '#5a4a7a' : '#000';
      ctx.lineWidth = 4;
      roundRect(ctx, gx, top, size, size, 10);
      ctx.stroke();
      gx += size + gap;
    }
  }

  // --- THE RUN's hand line: "HAND · A · B" (above the mascot box) ---
  if (model.handLine) {
    ctx.fillStyle = S.dim;
    const size = fit(model.handLine, 36, W - 2 * S.pad, 22);
    ctx.font = `700 ${size}px ${S.fonts.display}`;
    ctx.fillText(model.handLine, W / 2, S.runHandY);
  }

  // --- hook (THE RUN: centred in the band between the mascot box and the QR) ---
  ctx.fillStyle = model.neon;
  if (isRun) {
    const size = fit(S.hook, 52, bandW, 24);
    ctx.font = `700 ${size}px ${S.fonts.display}`;
    ctx.fillText(S.hook, bandC, S.hookY);
  } else {
    ctx.font = `700 52px ${S.fonts.display}`;
    ctx.fillText(S.hook, W / 2, S.hookY);
  }

  // --- url ---
  ctx.fillStyle = S.dim;
  ctx.font = `700 30px ${S.fonts.body}`;
  ctx.textAlign = 'left';
  ctx.fillText(S.url, bandL, W - 96);

  // --- mascot (bottom-left, contained in its fixed box) ---
  const mascot = await loadImage(model.mascotSrc);
  if (mascot) {
    const iw = mascot.naturalWidth || mascotBox.size;
    const ih = mascot.naturalHeight || mascotBox.size;
    const k = Math.min(mascotBox.size / iw, mascotBox.size / ih);
    const dw = iw * k;
    const dh = ih * k;
    ctx.drawImage(mascot, mascotBox.x + (mascotBox.size - dw) / 2, mascotBox.y + (mascotBox.size - dh), dw, dh);
  }

  // --- scannable QR (bottom-right) to the ?ref=share URL ---
  await drawQR(ctx, REF_URL, S.qr.x, S.qr.y, S.qr.size, { dark: S.bg, light: '#ffffff' });

  return canvas;
}
