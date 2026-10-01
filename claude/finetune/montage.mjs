// montage.mjs <out.png> <cols> <img...> — quick grid of frames at reduced width, labelled.
import { chromium } from '@playwright/test';
import fs from 'fs';
const [out, cols, ...imgs] = process.argv.slice(2);
const W = 1900; const cw = Math.floor(W / +cols) - 8;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: 800 } });
await p.setContent(`<body style="margin:0;background:#222;color:#ddd;font:13px monospace;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:8px">${imgs.map((f) => `<div>${f.split(/[\/]/).slice(-2).join('/')}<img style="display:block;width:100%" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></div>`).join('')}</body>`);
const h = await p.evaluate(() => document.body.scrollHeight); await p.setViewportSize({ width: W, height: h });
await p.screenshot({ path: out }); await b.close();
