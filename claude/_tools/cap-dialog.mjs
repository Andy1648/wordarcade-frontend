import { chromium } from '@playwright/test';
import { installBackendMock, freezeAnimations } from '../../e2e/support/backendMock.js';
const out='claude/card-polish/r6'; import fs from 'fs'; fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch();
for (const [w,h,tag] of [[1280,900,'desktop'],[390,844,'mobile']]) {
  const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:w,height:h}, deviceScaleFactor:2 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(()=>{ try{ localStorage.setItem('taw.xp', JSON.stringify({lv:40,into:0})); }catch{} });
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await freezeAnimations(p); await p.waitForTimeout(400);
  await p.locator('.game-card-magnet[data-game="category-blitz"] .game-card').click();
  await p.locator('.mode-dialog-shell.is-blitz').waitFor();
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/blitz-dialog-${tag}.png` });
  await ctx.close();
}
await b.close(); console.log('dialog -> r6');
