import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('wa_has_played', '1'); localStorage.setItem('taw.menuTierSeen', '9'); localStorage.setItem('taw.wins', '50000'); });
  await p.goto('http://localhost:4321/?portal=1'); await p.waitForTimeout(2200);
  await p.screenshot({ path: `claude/step21/menu-nav-${w}.png` });
  await p.locator(w > 480 ? '.homepage-nav-btn.is-shop' : '.hp-m-navbtn.is-shop').click(); await p.waitForTimeout(700);
  await p.screenshot({ path: `claude/step21/shop-top-${w}.png` });
  await p.locator('.shop-theme-grid').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.screenshot({ path: `claude/step21/shop-themes-${w}.png` });
  await p.close();
}
await b.close();
