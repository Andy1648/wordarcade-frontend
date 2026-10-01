// node claude/step21/marks-cap.mjs <variant> [port] — the marks picker with 7 unlocked marks at ranks I..V
import { chromium } from '@playwright/test';
const variant = process.argv[2] || 'coin'; const port = process.argv[3] || 4321;
const b = await chromium.launch();
for (const [w, h] of [[1280, 800], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(() => {
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('taw.menuTierSeen', '9');
    localStorage.setItem('taw.achievements', JSON.stringify(['m-wb-5', 'm-blitz-5', 'm-sat-5', 'sec-dict', 'wpm-70', 'lv-15', 'sec-eternal']));
    localStorage.setItem('taw.mark', 'mk-bomber');
    localStorage.setItem('taw.markWords', JSON.stringify({ 'mk-bomber': 320, 'mk-sprinter': 20, 'mk-scholar': 900, 'mk-linguist': 2100, 'mk-metronome': 5000, 'mk-student': 160, 'mk-eternal': 4200 }));
  });
  await p.goto(`http://localhost:${port}/?portal=1&markv=${variant}`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `claude/step21/marks-${variant}-menu-${w}.png` });
  const slot = p.locator('.menu-mark').first();
  if (await slot.count()) { await slot.click(); await p.waitForTimeout(500); }
  await p.screenshot({ path: `claude/step21/marks-${variant}-picker-${w}.png` });
  await p.close();
}
await b.close();
