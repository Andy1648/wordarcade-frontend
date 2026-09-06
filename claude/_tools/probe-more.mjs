import { chromium } from '@playwright/test';
import { installBackendMock, freezeAnimations } from '../../e2e/support/backendMock.js';
const b = await chromium.launch();
const sizes = [[1425,614],[1440,900],[1366,768],[1280,700],[1280,551],[1024,768],[900,700],[820,600],[768,700],[1000,500],[1200,620],[1600,900],[1920,1080]];
for (const [w,h] of sizes){
  const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:w,height:h}, deviceScaleFactor:1 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(()=>{ try{ localStorage.setItem('taw.xp', JSON.stringify({lv:40,into:0})); }catch{} });
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await freezeAnimations(p);
  await p.waitForTimeout(500);
  const r = await p.evaluate(()=>{
    const scroll = document.querySelector('.homepage-cards-scroll');
    const cards = [...document.querySelectorAll('.game-card-magnet')];
    const rb = scroll.getBoundingClientRect().bottom;
    let below=0; cards.forEach(c=>{ if (c.getBoundingClientRect().bottom > rb+1) below++; });
    const btn = document.querySelector('.homepage-cards-more');
    return { below, btnText: btn? btn.textContent.trim().replace(/\s+/g,' '): null,
      scrollOverflow: scroll.scrollHeight - scroll.clientHeight,
      cols: document.querySelector('.homepage-cards-grid')?.getAttribute('data-cols') };
  });
  console.log(`${w}x${h}  below=${r.below} btn=${JSON.stringify(r.btnText)} overflow=${r.scrollOverflow} cols=${r.cols}`);
  await ctx.close();
}
await b.close();
