// probe.mjs — print the box tree (depth<=4, boxes >=200px) of a page state, to find panel classes.
import { chromium } from '@playwright/test';
const [url, w, h] = [process.argv[2], +process.argv[3] || 1920, +process.argv[4] || 1080];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: w, height: h } });
await p.goto(url); await p.waitForTimeout(2500);
console.log(await p.evaluate(() => { const out = []; const walk = (el, d) => { if (d > 6) return; for (const c of el.children) { const r = c.getBoundingClientRect(); if (r.width >= 200 && r.height >= 120) out.push(`${'  '.repeat(d)}${c.tagName.toLowerCase()}.${(c.className?.baseVal ?? c.className).toString().split(' ').slice(0,3).join('.')} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)}`); walk(c, d + 1); } }; walk(document.body, 0); return out.join('\n'); }));
await b.close();
