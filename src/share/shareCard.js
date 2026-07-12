// src/share/shareCard.js
// Actions for the shareable result card. Renders to a DEDICATED offscreen 1080
// canvas (created here, never the live juice FX canvas). The card is PRE-RENDERED
// (prepareCard) so the SHARE tap can call navigator.share immediately inside the
// user gesture — Web Share needs transient activation that a slow render would
// consume. Read-only: touches no game state. Each action fires a PostHog capture.

import { buildCardModel } from './cardModel';
import { renderCard } from './renderCard';
import { REF_URL } from './shareConfig';
import { track } from '../lib/analytics';

let sharedCanvas = null;
function getCanvas() {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas'); // offscreen, never added to the DOM
    sharedCanvas.width = 1080;
    sharedCanvas.height = 1080;
  }
  return sharedCanvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    try { canvas.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); }
  });
}

function fire(mode, method) {
  // track() is already try/caught and gated on posthogReady; this is analytics only.
  try { track('result_card_shared', { mode, method }); } catch { /* no-op */ }
}

const fileName = (mode) => `typeaword-${mode || 'result'}.png`;

// Render the card once (fonts, mascot, QR) and return everything the gesture
// handlers need. Call this on mount so the SHARE tap is instant.
export async function prepareCard(args) {
  const model = buildCardModel(args);
  await renderCard(getCanvas(), model);
  const blob = await canvasToBlob(getCanvas());
  const file = blob ? new File([blob], fileName(args.mode), { type: 'image/png' }) : null;
  return { model, blob, file, mode: args.mode };
}

function triggerDownload(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* no-op */
  }
}

// SHARE (gesture). Native file-share when supported (feature-detected), else
// download. Returns the method used. Pass the prepared { mode, file, model, blob }.
export async function shareFile(prepared) {
  const { mode, file, model, blob } = prepared || {};
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], text: model.copy, url: model.link || REF_URL });
      fire(mode, 'native');
      return 'native';
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'aborted'; // user cancelled — no fallback/event
    // otherwise fall through to download
  }
  if (blob) triggerDownload(blob, fileName(mode));
  fire(mode, 'download');
  return 'download';
}

// DOWNLOAD (gesture) — always-available PNG.
export function downloadPng(prepared) {
  const { mode, blob } = prepared || {};
  if (blob) triggerDownload(blob, fileName(mode));
  fire(mode, 'download');
  return 'download';
}

// COPY (gesture) — spoiler-free Wordle-style summary + the ref URL.
export async function copySummary(prepared) {
  const { mode, model } = prepared || {};
  try { await navigator.clipboard.writeText(model.copy); } catch { /* clipboard blocked */ }
  fire(mode, 'copy');
  return model.copy;
}
