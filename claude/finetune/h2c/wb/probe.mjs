// one live (motion-on) shot + the title's box, for spot checks. usage: node probe.mjs 2560x1440 ingame-word-bomb out.png 1500
import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCREENS } from '../../../../e2e/support/screens.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const [vp = '2560x1440', name = 'ingame-word-bomb', out = 'probe.png', wait = '4500'] = process.argv.slice(2);
const [w, h] = vp.split('x').map(Number);
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: 'http://localhost:4191', viewport: { width: w, height: h } });
const p = await ctx.newPage();
await SCREENS.find((x) => x.name === name).nav(p);
await p.waitForTimeout(+wait);
await p.screenshot({ path: path.join(here, out) });
console.log(await p.evaluate(() => [...document.querySelectorAll('.game-title, .game-title *, .game-combo-box, .wb-ring, .bomb-svg, .game-input, .game-send-btn, .wb-timer, .wb-status, .game-used, .lstack')].map((e) => { const r = e.getBoundingClientRect(); return `${e.className.baseVal ?? e.className} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] fs=${getComputedStyle(e).fontSize} sw=${e.scrollWidth} cw=${e.clientWidth}`; }).join('\n')));
await b.close();
