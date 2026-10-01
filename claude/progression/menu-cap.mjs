// usage: node claude/progression/cap.mjs <tag> [query] [port] — menu at L1/L60/L150R3, desktop + phone
import { chromium } from '@playwright/test';
const tag = process.argv[2] || 'shot'; const q = process.argv[3] || ''; const port = process.argv[4] || 4311;
const b = await chromium.launch();
const profiles = [['l150r3', 150, 3, 90000]];
for (const [name, lv, rb, wins] of profiles) for (const [w, h] of [[1280, 720], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript(([lv, rb, wins]) => { try {
    localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
    localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('wa_has_played', '1');
    localStorage.setItem('taw.menuTierSeen', '9');
    localStorage.setItem('taw.achievements', JSON.stringify(['ascendant','rebirth','veteran','first-word']));
    if (rb) localStorage.setItem('taw.rebirths', String(rb));
    if (wins) { localStorage.setItem('taw.wins', String(wins)); localStorage.setItem('taw.winsLifetime', String(wins)); }
  } catch {} }, [lv, rb, wins]);
  await p.goto(`http://localhost:${port}/?portal=1${q ? '&' + q : ''}`); await p.waitForTimeout(1800);
  await p.screenshot({ path: `claude/progression/${tag}-${name}-${w}.png` });
  await p.close();
}
await b.close();
