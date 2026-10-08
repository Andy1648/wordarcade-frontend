// iconsheet.mjs — render any set of KIT ICONS at the sizes they are actually DRAWN at, on the plum panel.
// Built for the R5 oct8 icon audit (which caught REBIRTH reading as a pie chart at 24px and GEARS' blob cog):
// judging an icon at 104px hides everything that is wrong with it at 24.
//
//   node tools/_shots/iconsheet.mjs power,shop,rebirth out.png
//   node tools/_shots/iconsheet.mjs all out.png
//
// Columns are 24 / 40 / 64 / 104 px. The 24px column drops the class="x" EXTRAS, exactly as KitIcon does.
import { chromium } from '@playwright/test';
import { KIT_ICONS } from '../../src/components/kit/kitIconData.js';

const arg = process.argv[2] || 'all';
const names = arg === 'all' ? Object.keys(KIT_ICONS) : arg.split(',').map((s) => s.trim()).filter(Boolean);
const out = process.argv[3] || 'iconsheet.png';
const missing = names.filter((n) => !KIT_ICONS[n]);
if (missing.length) {
  console.error('unknown icon(s):', missing.join(', '));
  process.exit(1);
}

const drop = (size) => (size >= 72 ? 4 : size >= 36 ? 3 : 2);
const svg = (d, size, extras) =>
  `<svg viewBox="0 0 100 100" width="${size}" height="${size}" overflow="visible" style="filter:drop-shadow(${drop(size)}px ${drop(size)}px 0 #000)">`
  + `<g transform="rotate(${d.rot} 50 50)" stroke="#0d0618" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">`
  + `${extras ? d.body : d.body.replace(/<(path|circle|rect|ellipse) class="x"[^>]*\/>/g, '')}</g></svg>`;

const row = (n) => {
  const d = KIT_ICONS[n];
  return `<div style="display:flex;gap:36px;align-items:flex-end">`
    + `<span style="width:120px;font:14px monospace;color:#c9b8e8">${n}</span>`
    + `${svg(d, 24, false)}${svg(d, 40, true)}${svg(d, 64, true)}${svg(d, 104, true)}</div>`;
};

const html = `<body style="margin:0;background:#1a0b2e;display:flex;flex-direction:column;gap:26px;padding:24px 40px">${names.map(row).join('')}</body>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: 540, height: 60 + names.length * 150 }, deviceScaleFactor: 2 })).newPage();
await page.setContent(html);
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out, `(${names.length} icon${names.length === 1 ? '' : 's'})`);
