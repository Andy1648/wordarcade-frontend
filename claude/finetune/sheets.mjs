// sheets.mjs — one contact sheet per (profile, screen): the four fine-tune viewports in a 2x2 grid.
// Usage: node claude/finetune/sheets.mjs claude/finetune/pass-1/before
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const dir = path.resolve(process.argv[2]);
const VPS = ['390x844', '1280x551', '1366x625', '1920x1080'];
const out = path.join(dir, 'sheets');
fs.mkdirSync(out, { recursive: true });

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1840, height: 1200 } });
for (const profile of ['lv1', 'vet']) {
  const pdir = path.join(dir, profile);
  if (!fs.existsSync(pdir)) continue;
  const screens = [...new Set(fs.readdirSync(pdir).filter((f) => f.endsWith('.png')).map((f) => f.split('__')[0]))].sort();
  for (const s of screens) {
    const cells = VPS.map((vp) => {
      const f = path.join(pdir, `${s}__${vp}.png`);
      const img = fs.existsSync(f) ? `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">` : '<div class="miss">not captured</div>';
      return `<figure><figcaption>${vp}</figcaption>${img}</figure>`;
    });
    await page.setContent(`<style>
      body{margin:0;background:#222;font:16px monospace;color:#eee}
      h1{margin:6px 10px;font-size:18px}
      .g{display:flex;gap:10px;padding:0 8px 8px;align-items:flex-start}
      .l{width:390px;flex:none}.r{flex:1;display:flex;flex-direction:column;gap:8px}
      figure{margin:0}figcaption{font-size:13px;color:#aaa}
      img{display:block;width:100%;border:1px solid #555}
      .miss{padding:30px;border:1px dashed #666}
    </style><h1>${profile} / ${s}</h1><div class="g"><div class="l">${cells[0]}</div><div class="r">${cells.slice(1).join('')}</div></div>`);
    await page.waitForLoadState('load');
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 1840, height: h });
    await page.screenshot({ path: path.join(out, `${profile}__${s}.png`) });
    await page.setViewportSize({ width: 1840, height: 1200 });
  }
}
await b.close();
console.log('sheets ->', out);
