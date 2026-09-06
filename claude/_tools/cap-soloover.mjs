import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b=await chromium.launch();
for(const g of ['chain','fuse']){
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:1440,height:900},deviceScaleFactor:1});
  const p=await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(()=>{try{localStorage.setItem('taw.xp',JSON.stringify({lv:40,into:0}))}catch{}});
  await p.goto('/?portal=1&soloms=100'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await p.waitForTimeout(300);
  await p.locator(`.game-card-magnet[data-game="${g}"] .game-card`).click({force:true});
  await p.locator('.mode-dialog-shell').waitFor(); await p.locator('.mode-dialog-btn-create').click();
  const i=p.locator('.solo-root input').first(); await i.waitFor(); await i.fill(g==='chain'?'e':'a');
  await p.locator('.solo-deathcard').waitFor({timeout:12000}); await p.waitForTimeout(500);
  await p.screenshot({path:`claude/gameover-pass/shots/${g}-mascot.png`});
  console.log(g,'ok'); await ctx.close();
}
await b.close();
