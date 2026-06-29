// src/share/qr.js
// Real, scannable QR for the share card. Lazy-loads qrcode-generator (tiny, no
// deps) only when a card is actually rendered, encodes the URL, and paints the
// modules onto the given canvas context as crisp squares with a quiet zone.

let qrcodeLib = null;

async function getLib() {
  if (!qrcodeLib) {
    const mod = await import('qrcode-generator');
    qrcodeLib = mod.default || mod;
  }
  return qrcodeLib;
}

// Draw a scannable QR for `text` into the box (x, y, size) on ctx. Error
// correction 'M' tolerates the small footprint. Returns true on success.
export async function drawQR(ctx, text, x, y, size, { dark = '#0d0618', light = '#ffffff' } = {}) {
  try {
    const qrcode = await getLib();
    const qr = qrcode(0, 'M'); // type 0 = auto-fit version
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4; // modules of quiet zone (required for reliable scanning)
    const total = count + quiet * 2;
    const cell = size / total;

    // White card behind the code (with the quiet zone) so it scans on any bg.
    ctx.fillStyle = light;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = dark;
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          // +0.5px overdraw kills seams between cells when cell isn't integral.
          ctx.fillRect(
            x + (c + quiet) * cell,
            y + (r + quiet) * cell,
            cell + 0.5,
            cell + 0.5
          );
        }
      }
    }
    return true;
  } catch {
    return false; // never let a QR failure break card rendering
  }
}
