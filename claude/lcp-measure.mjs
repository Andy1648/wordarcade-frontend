import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4321';

async function menuLcp(theme) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('taw.theme', t);
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* ignore */ }
  }, theme);
  // Collect LCP entries.
  await page.addInitScript(() => {
    window.__lcp = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.renderTime || e.loadTime || e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* ignore */ }
  });
  await page.goto(`${BASE}/?portal=1`, { waitUntil: 'load' });
  // Let the menu settle + LCP finalize (wordmark/cards paint).
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const logo = document.querySelector('.homepage-logo');
    const logoColor = logo ? getComputedStyle(logo).color : null;
    const nav = performance.getEntriesByType('navigation')[0] || {};
    return {
      lcp: Math.round(window.__lcp || 0),
      fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0),
      dataTheme: root.dataset.theme,
      themeBg: cs.getPropertyValue('--theme-bg').trim(),
      themeInk: cs.getPropertyValue('--theme-ink').trim(),
      logoColor,
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
    };
  });
  await browser.close();
  return info;
}

for (const theme of ['default', 'midnight', 'inferno', 'toxic', 'prism']) {
  const r = await menuLcp(theme);
  console.log(
    `${theme.padEnd(9)} data-theme=${String(r.dataTheme).padEnd(9)} --theme-bg=${r.themeBg.padEnd(9)} --theme-ink=${r.themeInk.padEnd(9)} logo=${r.logoColor}  | FCP=${r.fcp}ms LCP=${r.lcp}ms`
  );
}
