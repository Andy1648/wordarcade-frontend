import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b=await chromium.launch();
for(const [w,h] of [[1440,900],[1366,768],[1920,1080]]){
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(()=>{try{localStorage.setItem('taw.xp',JSON.stringify({lv:40,into:0}))}catch{}});
  await p.goto('/?satRush=1&portal=1&stage=1000&spell=350'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"] .game-card').click({force:true}); await p.waitForTimeout(300);
  await p.getByRole('button',{name:'Play'}).click().catch(()=>{});
  await p.getByRole('button',{name:/BRIEFING/}).click().catch(()=>{}); await p.waitForTimeout(500);
  const s=p.getByRole('button',{name:'Start the run'}); if(await s.count()) await s.first().click().catch(()=>{});
  try{ await p.locator('.sr-respage').waitFor({timeout:45000}); }catch{}
  await p.waitForTimeout(3500); // let the reveal animate in
  const info=await p.evaluate(()=>{ const a=document.querySelector('.sr-results-actions'); const btn=document.querySelector('.sr-results-actions .sr-btn'); const cc=document.querySelector('.sr-dead'); const r=btn?btn.getBoundingClientRect():null; const c=cc?cc.getBoundingClientRect():null; return {actionsOpacity: a?getComputedStyle(a).opacity:'na', firstBtnBottom: r?Math.round(r.bottom):null, vh:window.innerHeight, ccTop: c?Math.round(c.top):null, btnInView: r?(r.bottom<=window.innerHeight+1&&r.top>=-1):null}; });
  console.log(`${w}x${h}: ${JSON.stringify(info)}`);
  await p.screenshot({path:`claude/gameover-pass/shots/sat-fix-${w}x${h}.png`});
  await ctx.close();
}
await b.close();
