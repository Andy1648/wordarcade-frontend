import { chromium } from '@playwright/test';
import { installBackendMock, freezeAnimations } from '../../e2e/support/backendMock.js';
const out='claude/card-polish/r7'; import fs from 'fs'; fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch();
// MENU spotlight — fresh player (no onboarding flags). Do NOT interact before the shot.
{
  const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:1280,height:820}, deviceScaleFactor:2 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(()=>{ try{ localStorage.setItem('taw.xp', JSON.stringify({lv:3,into:0})); }catch{} });
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor();
  await p.locator('.spotlight-overlay').waitFor({ timeout: 4000 }).catch(()=>{});
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/menu-spotlight.png` });
  // verify a keystroke dismisses AND counts (spotlight gone; still on menu)
  const before = await p.locator('.spotlight-overlay').count();
  await p.keyboard.press('a');
  await p.waitForTimeout(300);
  const after = await p.locator('.spotlight-overlay').count();
  console.log('MENU spotlight before/after keypress:', before, after);
  await ctx.close();
}
// CHAIN game spotlight — fresh game flag, unlocked (lv40), deep-link ?chain=1.
{
  const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:1280,height:820}, deviceScaleFactor:2 });
  const p = await ctx.newPage(); await installBackendMock(p);
  await p.addInitScript(()=>{ try{ localStorage.setItem('taw.xp', JSON.stringify({lv:40,into:0})); }catch{} });
  await p.goto('/?chain=1&portal=1');
  await p.locator('.solo-input').waitFor({ timeout: 8000 }).catch(()=>{});
  await p.locator('.spotlight-overlay').waitFor({ timeout: 6000 }).catch(()=>{});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/chain-spotlight.png` });
  const before = await p.locator('.spotlight-overlay').count();
  await p.keyboard.press('c');
  await p.waitForTimeout(300);
  const val = await p.locator('.solo-input').inputValue().catch(()=>'?');
  const after = await p.locator('.spotlight-overlay').count();
  console.log('CHAIN spotlight before/after keypress:', before, after, ' input value after:', JSON.stringify(val));
  await ctx.close();
}
await b.close(); console.log('spot -> r7');
