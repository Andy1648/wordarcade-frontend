import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const VPS = ['1920x1080', '1366x768', '390x844'];
const SHOTS = 'claude/shots';

test('build contact sheets', async ({ page }) => {
  test.setTimeout(120000);
  const screens = fs.readdirSync(SHOTS).filter((d) => fs.statSync(path.join(SHOTS, d)).isDirectory()).sort();
  for (const vp of VPS) {
    const tiles = [];
    for (const s of screens) {
      const p = path.join(SHOTS, s, `${vp}.png`);
      if (!fs.existsSync(p)) continue;
      const b64 = fs.readFileSync(p).toString('base64');
      tiles.push(`<figure><img src="data:image/png;base64,${b64}"><figcaption>${s}</figcaption></figure>`);
    }
    const cols = vp === '390x844' ? 6 : 4;
    const html = `<!doctype html><meta charset=utf8><style>
      body{margin:0;background:#160f28;font-family:monospace;padding:16px}
      h1{color:#FFE94A;font-size:22px}
      .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px}
      figure{margin:0;background:#0d0618;border:2px solid #333;border-radius:6px;overflow:hidden}
      img{width:100%;display:block;border-bottom:2px solid #333}
      figcaption{color:#2EFFE0;font-size:13px;padding:6px 8px;text-align:center}
      </style><h1>CONTACT SHEET — ${vp} — ${tiles.length} screens</h1>
      <div class=grid>${tiles.join('')}</div>`;
    await page.setViewportSize({ width: cols === 6 ? 1400 : 1800, height: 1000 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/_contact-${vp}.png`, fullPage: true });
    fs.writeFileSync(`${SHOTS}/_contact-${vp}.html`, html);
  }
});
