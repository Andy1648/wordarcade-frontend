import { chromium } from '@playwright/test';
import { installBackendMock, freezeAnimations } from '../../e2e/support/backendMock.js';
const out = process.argv[2] || 'claude/card-polish/r0';
import fs from 'fs'; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
// LV1 so CHAIN/FUSE show locked; also an LV40 pass so they show unlocked art.
for (const [lv, tag] of [[1,'lv1'],[40,'lv40']]) {
  const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:1280,height:900}, deviceScaleFactor:2 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript((L)=>{ try{ localStorage.setItem('taw.xp', JSON.stringify({lv:L,into:0})); }catch{} }, lv);
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await freezeAnimations(p); await p.waitForTimeout(500);
  const grid = p.locator('.homepage-cards-grid');
  if (await grid.count()) await grid.screenshot({ path: `${out}/cards-${tag}.png` });
  else await p.screenshot({ path: `${out}/cards-${tag}.png` });
  await ctx.close();
}
await b.close(); console.log('cards ->', out);
