import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await p.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {} });
await p.goto('http://localhost:4321/?portal=1', { waitUntil: 'load' });
await p.waitForTimeout(2000); // settle past any one-shot entrance anims
const r = await p.evaluate(() => {
  const anims = document.getAnimations();
  const infinite = anims.filter(a => { try { const d = a.effect.getTiming().iterations; return d === Infinity && a.playState === 'running'; } catch { return false; } });
  const byName = {};
  for (const a of infinite) { const n = a.animationName || (a.effect && a.effect.getKeyframes && 'css') || 'js'; byName[n] = (byName[n] || 0) + 1; }
  return { total: anims.length, infiniteRunning: infinite.length, byName, domNodes: document.querySelectorAll('*').length, cardArtSvgs: document.querySelectorAll('.game-card svg').length };
});
console.log(JSON.stringify(r, null, 0));
await b.close();
