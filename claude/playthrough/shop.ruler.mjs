import { test } from '@playwright/test';
test.use({ viewport: { width: 390, height: 844 } });
test('shop scroll check', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('wa_last_seen', String(Date.now())); localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); localStorage.setItem('taw.wins', '9999999'); } catch {} });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(500);
  await page.locator('.homepage-nav-btn.is-shop').click({ force: true });
  await page.locator('.shop-card-name').first().waitFor({ state: 'visible', timeout: 12000 });
  // Find the scrollable container and force it to the bottom to see the power upgrades.
  const info = await page.evaluate(() => {
    // The nearest scrollable ancestor of the shop cards.
    let el = document.querySelector('.shop-card-name');
    let scroller = null;
    while (el && el !== document.body) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) { scroller = el; break; } el = el.parentElement; }
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
    const names = [...document.querySelectorAll('.shop-card-name')].map((n) => n.textContent);
    const headings = [...document.querySelectorAll('.shop-wrap h2, .shop-screen h2, [class*="shop"] h2, .shop-section-title, [class*="section"]')].map((h) => h.textContent).slice(0, 12);
    return { hasScroller: !!scroller, names, headings };
  });
  console.log('SHOP hasScroller:', info.hasScroller);
  console.log('SHOP card names:', JSON.stringify(info.names));
  console.log('SHOP headings:', JSON.stringify(info.headings));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'claude/playthrough/28-shop-bottom.png' });
});
