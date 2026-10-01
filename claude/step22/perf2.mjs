import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => { localStorage.setItem('taw.xp', JSON.stringify({ lv: 150, into: 0 })); localStorage.setItem('taw.seenMenuSpotlight','1'); localStorage.setItem('taw.seenMenu','1'); localStorage.setItem('wa_has_played','1'); localStorage.setItem('taw.rebirths','3'); });
await p.goto('http://localhost:4311/?portal=1'); await p.waitForTimeout(3000);
for (let i = 0; i < 40; i++) { await p.keyboard.press('abcdefghij'[i % 10]); await p.waitForTimeout(33); }
for (const t of [2500, 5000, 9000]) {
  await p.waitForTimeout(t === 2500 ? 2500 : t === 5000 ? 2500 : 4000);
  const r = await p.evaluate(() => document.getAnimations().filter(x => x.playState === 'running').map(x => { const el = x.effect && x.effect.target; return (x.animationName || 'waapi') + ':' + (el ? (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) : '?') + ':' + Math.round(x.effect.getComputedTiming().duration) + ':' + x.effect.getComputedTiming().iterations; }));
  console.log(t, r.length, JSON.stringify([...new Set(r)]));
}
await b.close();
