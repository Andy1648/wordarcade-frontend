import { chromium } from '@playwright/test';
const OUT=process.argv[2]||'claude/splash/shots'; import fs from 'fs'; fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch();
for(const [w,h,tag] of [[1366,768,'desktop'],[390,844,'mobile'],[1920,1080,'wide']]){
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage();
  await p.addInitScript(()=>{try{localStorage.clear()}catch{}});
  await p.goto('/');
  let has=false;
  try{ await p.locator('.splash-screen').waitFor({state:'visible',timeout:12000}); has=true; }catch{}
  await p.waitForTimeout(900);
  await p.screenshot({path:`${OUT}/splash-${tag}.png`});
  console.log(`splash-${tag}: present=${has}`);
  await ctx.close();
}
await b.close();
