// Renders the before/after SVG charts into PNGs (STEP 19 wants PNG).
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const b = await chromium.launch();
for (const kind of ['level-vs-time', 'gaps']) {
  const p = await b.newPage({ viewport: { width: 1700, height: 700 } });
  const svg = (t) => fs.readFileSync(new URL(`./${t}-${kind}.svg`, import.meta.url), 'utf8');
  await p.setContent(`<body style="margin:0;background:#fff;display:flex;gap:12px;font:16px sans-serif"><div><h3 style="margin:6px">BEFORE (v8)</h3>${svg('before')}</div><div><h3 style="margin:6px">AFTER (v9)</h3>${svg('after')}</div></body>`);
  await p.screenshot({ path: new URL(`./before-after-${kind}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), fullPage: true });
}
await b.close();
