import { chromium } from '@playwright/test';
const b=await chromium.launch(); const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:390,height:844}});
const p=await ctx.newPage(); await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor();
await p.waitForFunction(()=>navigator.serviceWorker&&navigator.serviceWorker.controller!=null,{timeout:20000}).catch(()=>{});
await ctx.setOffline(true);
// dispatch offline event (setOffline doesn't always fire it in-page)
await p.evaluate(()=>window.dispatchEvent(new Event('offline')));
await p.waitForTimeout(400);
const banner=(await p.locator('[role=status]').filter({hasText:'NEED INTERNET'}).textContent().catch(()=>''))||'';
console.log('NEEDS INTERNET banner offline:', banner.trim()? 'SHOWN: "'+banner.trim().slice(0,70)+'..."' : 'NOT SHOWN');
await b.close();
