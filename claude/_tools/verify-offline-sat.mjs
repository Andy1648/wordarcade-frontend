import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor();
await p.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller!=null,{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1500);
await ctx.setOffline(true);
const pg=await ctx.newPage(); let steps=[];
try{
  await pg.goto('/?satRush=1&portal=1',{waitUntil:'domcontentloaded'});
  await pg.getByRole('img',{name:'Type a Word'}).waitFor({timeout:9000}); steps.push('menu-loaded-offline');
  await pg.locator('[data-game="sat-rush"] .game-card').waitFor({timeout:5000});
  await pg.locator('[data-game="sat-rush"] .game-card').click({force:true}); steps.push('card-clicked');
  await pg.waitForTimeout(600);
  // SAT flow: card -> (Play?) -> modeselect. Try Play if present.
  const play = pg.getByRole('button',{name:'Play'}); if(await play.count()) { await play.first().click().catch(()=>{}); steps.push('play-clicked'); }
  await pg.locator('.sr-modeselect, .sr-brief-page, .sr-slots').first().waitFor({timeout:8000}); steps.push('SAT-screen-rendered');
  // start briefing -> play
  const brief = pg.getByRole('button',{name:/BRIEFING/}); if(await brief.count()){ await brief.first().click().catch(()=>{}); await pg.locator('.sr-brief-page').waitFor({timeout:6000}).catch(()=>{}); const go=pg.getByRole('button',{name:'Start the run'}); if(await go.count()){ await go.first().click().catch(()=>{}); await pg.locator('.sr-slots').waitFor({timeout:8000}).catch(()=>{}); steps.push('SAT-PLAYING'); } }
}catch(e){ steps.push('ERR:'+String(e).split('\n')[0].slice(0,70)); }
console.log('SAT offline steps:', steps.join(' -> '));
await b.close();
