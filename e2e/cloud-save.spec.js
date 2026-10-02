// e2e/cloud-save.spec.js — STEP 52 (Andy oct2: "a friend's progress reset"). Against a board DB with
// migrations 005 + 006 (mocked): claiming a name backs the save up and shows the recovery code; a
// browser whose storage was wiped gets its progress back by itself; a NEW device gets it back from
// the code; and a restore never lowers progress.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const seedProgress = (page, lv) => page.addInitScript((lv) => {
  if (sessionStorage.getItem('cs.seeded')) return;
  sessionStorage.setItem('cs.seeded', '1');
  localStorage.setItem('taw.seenMenu', '1');
  localStorage.setItem('taw.seenMenuSpotlight', '1');
  localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
  localStorage.setItem('taw.rebirths', '2');
  localStorage.setItem('taw.wins', '4242');
}, lv);

async function claim(page, name) {
  await page.locator('.homepage-nav-btn.is-board').click();
  await page.locator('.lb-claim-input').fill(name);
  await expect(page.locator('.lb-verdict')).toHaveText(/FREE/);
  await page.locator('.lb-claim-btn').click();
  await expect(page.locator('.lb-you-name')).toHaveText(name);
}

test('claim → backup + recovery code; a wiped browser restores by itself; a new device restores from the code', async ({ browser }) => {
  test.setTimeout(90000);
  const shared = { rows: [], secrets: new Map(), saves: new Map() };
  // DEVICE A: progress, claim → the code is shown once and the save is in the cloud.
  const a = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pa = await a.newPage();
  await installBackendMock(pa);
  await mockBoard(pa, [], { caps: true, shared });
  await seedProgress(pa, 77);
  await pa.goto('/?portal=1');
  await menuReady(pa);
  await claim(pa, 'Saver_1');
  const code = (await pa.locator('.lb-code-value').innerText()).trim();
  expect(code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){11}$/);
  await expect.poll(() => shared.saves.size).toBe(1);

  // A WIPE (Safari's 7-day purge of localStorage): the identity survives in the cookie and the
  // menu brings the progress back with no input from the player.
  await pa.evaluate(() => { localStorage.clear(); localStorage.setItem('taw.seenMenu', '1'); });
  await pa.reload();
  await menuReady(pa);
  await expect.poll(() => pa.evaluate(() => JSON.parse(localStorage.getItem('taw.xp') || '{}').lv).catch(() => null), { timeout: 15000 }).toBe(77);
  // the restore reloads the page into the restored save — read after it settles
  await expect.poll(() => pa.evaluate(() => localStorage.getItem('taw.wins')).catch(() => null), { timeout: 15000 }).toBe('4242');
  await menuReady(pa);

  // DEVICE B: nothing local, no cookie → the code restores it.
  const b = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pb = await b.newPage();
  await installBackendMock(pb);
  await mockBoard(pb, [], { caps: true, shared });
  await pb.addInitScript(() => { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); });
  await pb.goto('/?portal=1');
  await menuReady(pb);
  await pb.locator('.hp-m-navbtn.is-board').click();
  await pb.locator('.lb-restore-open').click();
  await pb.locator('#lb-restore-input').fill(code);
  await pb.locator('.lb-restore .lb-claim-btn').click();
  await expect.poll(() => pb.evaluate(() => JSON.parse(localStorage.getItem('taw.xp') || '{}').lv).catch(() => null), { timeout: 15000 }).toBe(77);
  await expect.poll(() => pb.evaluate(() => JSON.parse(localStorage.getItem('taw.lb.profile') || '{}').username).catch(() => null), { timeout: 15000 }).toBe('Saver_1');
  await a.close();
  await b.close();
});

test('a restore never lowers progress: a browser ahead of the cloud keeps its own save', async ({ page }) => {
  const board = await (async () => {
    await installBackendMock(page);
    return mockBoard(page, [], { caps: true });
  })();
  await seedProgress(page, 20);
  await page.goto('/?portal=1');
  await menuReady(page);
  await claim(page, 'Ahead_1');
  await expect.poll(() => board.saves.size).toBe(1);
  // play on: this browser is now well past the backup
  await page.evaluate(() => localStorage.setItem('taw.xp', JSON.stringify({ lv: 60, into: 0 })));
  await page.evaluate(() => sessionStorage.removeItem('taw.cloud.restored'));
  await page.reload();
  await menuReady(page);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.xp')).lv)).toBe(60);
});
