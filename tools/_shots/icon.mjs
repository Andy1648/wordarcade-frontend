// Render one kit icon at several sizes on a plum panel, for a look.
import { chromium } from '@playwright/test';
import { KIT_ICONS } from '../../src/components/kit/kitIconsCore.js';
const name = process.argv[2] || 'shop';
const d = KIT_ICONS[name];
const svg = (size, extras) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" overflow="visible" style="filter:drop-shadow(${size>=72?4:3}px ${size>=72?4:3}px 0 #000)"><g transform="rotate(${d.rot} 50 50)" stroke="#0d0618" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">${extras ? d.body : d.body.replace(/<path class="x"[^>]*\/>/g, '')}</g></svg>`;
const html = `<body style="margin:0;background:#1a0b2e;display:flex;gap:40px;align-items:flex-end;padding:40px 48px">${svg(36,false)}${svg(56,true)}${svg(96,true)}${svg(160,true)}</body>`;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 560, height: 260 }, deviceScaleFactor: 2 })).newPage();
await p.setContent(html); await p.screenshot({ path: process.argv[3] || '/tmp/icon.png' }); await b.close();
