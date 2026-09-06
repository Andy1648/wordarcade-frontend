// measure the RUN card + titlebar geometry and the SVG viewBox->screen mapping.
import { chromium } from '@playwright/test';
const BASE = 'http://localhost:4173';
for (const width of [390, 1366]) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 })); } catch {} });
  await page.goto(`${BASE}/?portal=1`, { waitUntil: 'networkidle' });
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(600);
  const data = await page.evaluate(() => {
    const card = document.querySelector('.game-card-magnet[data-game="run"] .game-card');
    const bar = document.querySelector('.game-card-magnet[data-game="run"] .game-card-titlebar');
    const svg = document.querySelector('.game-card-magnet[data-game="run"] .card-art');
    const cr = card?.getBoundingClientRect();
    const br = bar?.getBoundingClientRect();
    const sr = svg?.getBoundingClientRect();
    return {
      card: cr && { w: Math.round(cr.width), h: Math.round(cr.height) },
      bar: br && cr && { topFromCardBottom: Math.round(cr.bottom - br.top), barH: Math.round(br.height) },
      svg: sr && { w: Math.round(sr.width), h: Math.round(sr.height) },
    };
  });
  // compute visible viewBox band for xMidYMid slice of 300x400 into card w×h
  const { w, h } = data.card;
  const scale = Math.max(w / 300, h / 400);
  const dispW = 300 * scale, dispH = 400 * scale;
  const offX = (dispW - w) / 2, offY = (dispH - h) / 2;
  const vbX0 = offX / scale, vbX1 = (offX + w) / scale;
  const vbY0 = offY / scale, vbY1 = (offY + h) / scale;
  // scrim covers bottom barH px of card -> in viewBox Y
  const scrimVbY = vbY1 - (data.bar.barH / scale);
  console.log(`--- width ${width} --- card ${w}x${h}`);
  console.log(`  visible viewBox X: ${vbX0.toFixed(0)}..${vbX1.toFixed(0)}  Y: ${vbY0.toFixed(0)}..${vbY1.toFixed(0)}`);
  console.log(`  titlebar height ~${data.bar.barH}px -> scrim starts at viewBox Y ~${scrimVbY.toFixed(0)} (art below this is dimmed)`);
  await browser.close();
}
