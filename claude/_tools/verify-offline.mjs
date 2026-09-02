import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto('/?portal=1'); await p.getByRole('img', { name: 'Type a Word' }).waitFor();
await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller != null, { timeout: 20000 }).catch(()=>{});
const cc = await p.evaluate(async () => { const ns=await caches.keys(); let n=0; for(const k of ns){n+=(await caches.open(k)).then?(await (await caches.open(k)).keys()).length:0;} return n; });
console.log('SW controlling:', await p.evaluate(()=>!!navigator.serviceWorker.controller), '| precache entries:', cc);
await p.waitForTimeout(1500);
await ctx.setOffline(true);
console.log('--- NETWORK DISABLED ---');
async function solo(query, rootSel, label){
  const pg=await ctx.newPage(); let dv='',rootOk=false,typed=false,err='';
  try{
    await pg.goto('/?'+query,{waitUntil:'domcontentloaded'});
    await pg.locator(rootSel).waitFor({timeout:9000});
    rootOk=true;
    const input=pg.locator(rootSel+' input').first(); await input.waitFor({timeout:6000});
    await input.fill('a'); await pg.waitForTimeout(700);
    dv=await pg.evaluate(()=>document.documentElement.getAttribute('data-view'));
    // a played letter => the input still holds it or produced a reason/reveal (word data loaded)
    typed = (await input.inputValue()).length>0 || await pg.locator('.solo-reason, .sr-slots, .solo-out').first().isVisible().catch(()=>false);
  }catch(e){ err=String(e).split('\n')[0].slice(0,70); }
  console.log(`${label.padEnd(6)} offline: root=${rootOk} view=${dv} typed=${typed} ${err?'ERR:'+err:''}`);
  await pg.close(); return rootOk;
}
await solo('chain=1&portal=1','.solo-root','chain');
await solo('fuse=1&portal=1','.solo-root','fuse');
// SAT deep-link -> modeselect renders offline
{ const pg=await ctx.newPage(); let ok=false,err='';
  try{ await pg.goto('/?satRush=1&portal=1',{waitUntil:'domcontentloaded'}); await pg.locator('[data-game="sat-rush"] .game-card').click({force:true,timeout:9000}).catch(()=>{}); await pg.locator('.sr-modeselect').waitFor({timeout:8000}); ok=true; }catch(e){err=String(e).split('\n')[0].slice(0,70);}
  console.log(`sat    offline: modeselect=${ok} ${err?'ERR:'+err:''}`); await pg.close(); }
await b.close();
