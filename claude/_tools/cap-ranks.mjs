import { chromium } from '@playwright/test';
import { installBackendMock, freezeAnimations } from '../../e2e/support/backendMock.js';
const out = 'claude/card-polish/r5'; import fs from 'fs'; fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch();
for (const [lv,tag] of [[18,'lv18'],[100,'lv100']]) {
  const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:1280,height:900}, deviceScaleFactor:2 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript((L)=>{ try{ localStorage.setItem('taw.xp', JSON.stringify({lv:L,into:0})); }catch{} }, lv);
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await freezeAnimations(p); await p.waitForTimeout(400);
  const btn = p.locator('.menu-xp-rank--btn');
  await btn.click();
  await p.locator('.rank-panel').waitFor();
  await p.waitForTimeout(300);
  await p.locator('.rank-panel').screenshot({ path: `${out}/rank-${tag}.png` });
  await ctx.close();
}
await b.close(); console.log('ranks -> r5');
