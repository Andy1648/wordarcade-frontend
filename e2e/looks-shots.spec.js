// e2e/looks-shots.spec.js — film harness for the POP STYLES (menu key-pop looks): each look typed at ~7 keys/s, CDP
// screencast frames → LOOK_SHOT_DIR/<vp>/<id>/NNNN.jpg + stamps.json (scratch tooling stitches them to GIFs). Runs only
// with LOOK_SHOT_DIR set; it asserts nothing the real specs do not.
import fs from 'node:fs';
import { test } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const DIR = process.env.LOOK_SHOT_DIR || '';
const IDS = (process.env.LOOK_IDS || 'classic,chrome,inferno,void,prism,toxic,ember,frost,gold,plasma,nova,eclipse,legend').split(',');
const VPS = [[1366, 657, 'desktop'], [390, 844, 'phone']];
test.use({ reducedMotion: 'no-preference' });
test.skip(!DIR, 'film harness: set LOOK_SHOT_DIR');

for (const [w, h, tag] of VPS) {
  test(`film every look @${tag}`, async ({ browser }) => {
    test.setTimeout(600000);
    for (const id of IDS) {
      const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, reducedMotion: 'no-preference', viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await installBackendMock(page);
      await page.addInitScript(({ p, pop }) => {
        if (sessionStorage.getItem('ls.seeded')) return;
        sessionStorage.setItem('ls.seeded', '1');
        Object.entries({ 'taw.tut.power': '1', 'taw.tut.gears': '1', 'taw.tut.rebirth': '1', 'taw.reduceMotion': '0', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p,
          'taw.owned': JSON.stringify(['classic', 'thock', pop]), 'taw.equipped': JSON.stringify({ popStyle: pop, soundPack: 'thock' }),
          'taw.s2.xp': JSON.stringify({ lv: 40, f: 0.1, rc: 4, v: 10 }), 'taw.s2.rebirths': '4' }).forEach(([k, v]) => localStorage.setItem(k, v));
      }, { p: PATCH_ID, pop: id });
      await page.goto('/?portal=1&season2=1');
      await menuReady(page);
      await page.waitForTimeout(1500);
      const dir = `${DIR}/${tag}/${id}`;
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
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 2 });
      await page.waitForTimeout(200);
      for (const key of 'TYPEAWORD') { await page.keyboard.press(`Key${key}`); await page.waitForTimeout(140); }
      await page.waitForTimeout(1300);
      await cdp.send('Page.stopScreencast');
      await page.waitForTimeout(150);
      fs.writeFileSync(`${dir}/stamps.json`, JSON.stringify(stamps));
      await ctx.close();
    }
  });
}
