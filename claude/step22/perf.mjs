import { chromium } from '@playwright/test';
const b = await chromium.launch();
const out = {};
for (const [name, lv, rb] of [['l1', 1, 0], ['l150r3', 150, 3]]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.addInitScript(([lv, rb]) => { localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 })); localStorage.setItem('taw.seenMenuSpotlight','1'); localStorage.setItem('taw.seenMenu','1'); localStorage.setItem('wa_has_played','1'); localStorage.setItem('taw.wins','900000'); if (rb) localStorage.setItem('taw.rebirths', String(rb)); }, [lv, rb]);
  await p.goto('http://localhost:4311/?portal=1');
  await p.waitForTimeout(4000);
  const rest = await p.evaluate(() => { const a = document.getAnimations(); return { running: a.filter(x => x.playState === 'running').length, infinite: a.filter(x => x.playState === 'running' && x.effect && x.effect.getComputedTiming().iterations === Infinity).map(x => (x.effect.target && x.effect.target.className) || x.animationName) }; });
  let peak = 0;
  for (let i = 0; i < 40; i++) { await p.keyboard.press('abcdefghij'[i % 10]); if (i % 5 === 4) peak = Math.max(peak, await p.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').length)); await p.waitForTimeout(33); }
  await p.waitForTimeout(2500);
  const after = await p.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').length);
  out[name] = { rest, typingPeak: peak, afterTyping: after };
  await p.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
