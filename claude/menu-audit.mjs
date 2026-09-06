import { chromium } from '@playwright/test';
const BASE = 'http://localhost:4321';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch {}
  window.__lcp = 0;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.renderTime || e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
});

// 3 warm loads — report the steady-state (min) LCP; the first cold load is browser warmup.
const lcps = [];
for (let i = 0; i < 3; i++) {
  await page.goto(`${BASE}/?portal=1`, { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  const lcp = await page.evaluate(() => Math.round(window.__lcp || 0));
  lcps.push(lcp);
}

// LCP element + menu reading order (vertical position of wordmark / cards / xp bar).
const audit = await page.evaluate(() => {
  const rect = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().top) : null; };
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return Math.round(r.width * r.height); };
  return {
    logoTop: rect('.homepage-logo'),
    cardsTop: rect('.homepage-cards-grid') ?? rect('.game-card-magnet'),
    barTop: rect('.menu-xp-bar'),
    logoArea: box('.homepage-logo'),
    cardsArea: box('.homepage-cards-grid'),
  };
});
await browser.close();
console.log('warm LCP (3 loads):', lcps.join(', '), 'ms  → steady', Math.min(...lcps), 'ms');
console.log('reading order (top px):  wordmark', audit.logoTop, '< cards', audit.cardsTop, '< xp bar', audit.barTop);
console.log('wordmark area', audit.logoArea, 'px²   cards area', audit.cardsArea, 'px²');
