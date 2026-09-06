import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import fs from 'fs'; const OUT='claude/wallscene/shots'; fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch();
for(const [w,h,tag] of [[1440,900,'desktop'],[390,844,'mobile']]){
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage(); await installBackendMock(p);
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor(); await p.waitForTimeout(800);
  await p.screenshot({path:`${OUT}/menu-with-${tag}.png`});
  await p.addStyleTag({content:'.wall-scene{display:none !important}'});
  await p.waitForTimeout(300);
  await p.screenshot({path:`${OUT}/menu-without-${tag}.png`});
  console.log(`${tag}: captured`);
  await ctx.close();
}
await b.close();
