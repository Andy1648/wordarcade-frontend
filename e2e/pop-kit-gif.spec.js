// e2e/pop-kit-gif.spec.js — GIF=1 only: films every POP STYLE kit in motion for Andy (CDP screencast frames + their
// timestamps → claude/shots/popkit/gif/<id>/; claude/popkit-gif.py stitches them). Keys, a CRIT, then a level wrap.
import fs from 'node:fs';
import { test } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const IDS = (process.env.KIT_IDS || 'chrome,inferno,void,prism,toxic,ember,frost,gold,plasma,nova,eclipse,legend').split(',');
test.use({ reducedMotion: 'no-preference' });

test('GIF: every kit in motion', async ({ browser }) => {
  test.skip(!process.env.GIF, 'films only');
  test.setTimeout(600000);
  for (const id of IDS) {
    const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, reducedMotion: 'no-preference', viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await installBackendMock(page);
    await page.addInitScript(({ p, pop, lv }) => {
      if (sessionStorage.getItem('pk.seeded')) return;
      sessionStorage.setItem('pk.seeded', '1');
      Object.entries({ 'taw.tut.power': '1', 'taw.tut.gears': '1', 'taw.tut.rebirth': '1', 'taw.reduceMotion': '0', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.owned': JSON.stringify(['classic', 'thock', 'clack', 'cream', pop]),
        'taw.equipped': JSON.stringify({ popStyle: pop, soundPack: 'thock' }), 'taw.s2.xp': JSON.stringify({ lv, f: 0.93, rc: 0, v: 10 }) }).forEach(([k, v]) => localStorage.setItem(k, v));
    }, { p: PATCH_ID, pop: id, lv: +(process.env.GIF_LV || 4) });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.waitForTimeout(1200);
    if (process.env.CAPDBG) console.log(await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; }; return JSON.stringify({ cap: document.querySelector('.kx-cap')?.style.transform, track: r('.kx-track'), fill: r('.kx-fill'), wrap: r('.kx-barwrap'), bar: r('.kx-bar') }); }));
    const dir = `claude/shots/popkit/gif/${id}`;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const cdp = await ctx.newCDPSession(page);
    const stamps = [];
    let n = 0;
    cdp.on('Page.screencastFrame', async (f) => {
      const name = String(n++).padStart(4, '0');
      fs.writeFileSync(`${dir}/${name}.jpg`, Buffer.from(f.data, 'base64'));
      stamps.push([name, f.metadata.timestamp]);
      try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* closed */ }
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, everyNthFrame: 1 });
    await page.waitForTimeout(300);
    for (const key of ['KeyQ', 'KeyW', 'KeyE', 'KeyR']) { await page.keyboard.press(key); await page.waitForTimeout(420); }
    await page.evaluate(() => { window.__rnd = Math.random; Math.random = () => 0; });
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(250);
    await page.evaluate(() => { Math.random = window.__rnd; });
    await page.waitForTimeout(1300);
    // fill to the wrap: keys until the bar crosses a level (the kit's fill moment)
    for (let i = 0; i < 14; i++) { await page.keyboard.press('KeyY'); await page.waitForTimeout(110); }
    await page.waitForTimeout(1500);
    await cdp.send('Page.stopScreencast');
    await page.waitForTimeout(200);
    fs.writeFileSync(`${dir}/stamps.json`, JSON.stringify(stamps));
    await ctx.close();
  }
});
