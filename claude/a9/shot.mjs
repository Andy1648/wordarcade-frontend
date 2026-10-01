import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w,h] of [[320,640],[390,844],[1280,720]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 27, into: 0 })); } catch {} });
  await p.goto('http://localhost:4311/?portal=1'); await p.waitForTimeout(2500);
  await p.keyboard.press('Escape').catch(()=>{});
  const t = await p.locator('.menu-xp-hint-text').first().innerText().catch(()=>'(none)');
  const el = p.locator('.menu-xp-hint').first();
  await (await el.count() ? el : p).screenshot({ path: `claude/a9/hint-${w}.png` });
  console.log(w, JSON.stringify(t));
}
await b.close();
