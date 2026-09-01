// contact-sheet.mjs — tile PNGs into labeled contact sheets. Usage: node contact-sheet.mjs <shotsDir> <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs'; import path from 'path';
const SHOTS = process.argv[2]; const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(SHOTS).filter(f => f.endsWith('.png'));
const groups = { desktop: files.filter(f => f.endsWith('-desktop.png')).sort(), mobile: files.filter(f => f.endsWith('-mobile.png')).sort() };

const b = await chromium.launch();
for (const [tag, list] of Object.entries(groups)) {
  if (!list.length) continue;
  const cols = tag === 'mobile' ? 6 : 4;
  const cells = list.map(f => {
    const label = f.replace(`-${tag}.png`, '');
    const data = fs.readFileSync(path.join(SHOTS, f)).toString('base64');
    return `<figure><img src="data:image/png;base64,${data}"><figcaption>${label}</figcaption></figure>`;
  }).join('');
  const html = `<!doctype html><meta charset=utf8><style>
    body{margin:0;background:#20232a;font-family:monospace}
    .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;padding:10px}
    figure{margin:0;background:#000;border:1px solid #444;border-radius:4px;overflow:hidden}
    img{display:block;width:100%;height:auto}
    figcaption{color:#7CFC00;font-size:13px;padding:4px 6px;background:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  </style><div class=grid>${cells}</div>`;
  const ctx = await b.newContext({ viewport: { width: tag === 'mobile' ? 1500 : 1600, height: 1000 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.screenshot({ path: path.join(OUT, `contact-${tag}.png`), fullPage: true });
  await ctx.close();
  console.log(`contact-${tag}.png  (${list.length} tiles, ${cols} cols)`);
}
await b.close();
