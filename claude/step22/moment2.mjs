import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => { if (sessionStorage.getItem('x')) return; sessionStorage.setItem('x','1'); localStorage.setItem('taw.xp', JSON.stringify({ lv: 150, into: 0 })); localStorage.setItem('taw.seenMenuSpotlight','1'); localStorage.setItem('taw.seenMenu','1'); localStorage.setItem('wa_has_played','1'); localStorage.setItem('taw.rebirths','3'); localStorage.removeItem('taw.menuTierSeen'); });
await p.goto('http://localhost:4311/?portal=1');
for (let i = 0; i < 12; i++) { const r = await p.evaluate(() => { const e = document.querySelector('.menu-xp-levelup'); const t = document.querySelector('.menu-xp-levelup-title'); return e ? [getComputedStyle(e).opacity, t.textContent, e.getAnimations().map(a=>a.playState+':'+Math.round(a.currentTime||0))] : null; }); console.log(i*150, JSON.stringify(r)); if (i===4) await p.screenshot({ path: 'claude/step22/moment-newframe.png' }); await p.waitForTimeout(150); }
await b.close();
