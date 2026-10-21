// e2e/unlisted-any-mode.spec.js — THE UNLISTED in a mode that is not Word Bomb (oct20, Andy "make accepted words count
// (not just randomly typing) … ensure 'newgrounds' has an opportunity … no matter the mode"):
//   1. CHAIN accepts NEWGROUNDS (it is on the shared accept list on purpose), and that ACCEPTED word finds O.G. — the
//      stamp lands above the CHAIN input and the gear is owned.
//   2. Typing NEWGROUNDS without it being accepted finds nothing.
// UL_SHOT_DIR=<dir> saves screenshots (1366x768 + 390x844).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SHOTS = process.env.UL_SHOT_DIR || '';
const VPS = [{ w: 1366, h: 768, tag: '1366x768' }, { w: 390, h: 844, tag: '390x844' }];
// a word for every CHAIN opener (chain.js CHAIN_OPENERS) that ENDS IN N, so the next link must start with N
const TO_N = {
  a: 'action', b: 'between', c: 'common', d: 'design', e: 'even', f: 'fashion', g: 'garden', h: 'human', i: 'iron',
  l: 'lemon', m: 'mountain', n: 'nation', o: 'open', p: 'person', r: 'reason', s: 'season', t: 'town', w: 'woman',
};

async function seed(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.chain.runs', '5');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      window.__TAW_RARE_POP = 'off'; // no MIDAS roll mid-test
    } catch { /* ignore */ }
  });
}
async function startChain(page) {
  await page.goto('/?chain=1&portal=1');
  await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
}
const required = async (page) => (await page.locator('.solo-center').first().innerText()).trim().toLowerCase().slice(0, 1);
async function play(page, word) {
  const input = page.locator('.solo-input');
  await input.fill(word);
  await input.press('Enter');
  await expect(input).toHaveValue('', { timeout: 5000 });
}
const owned = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('taw.unlisted') || '{}').owned || {}; } catch { return {}; } });

for (const vp of VPS) {
  test(`@${vp.tag} CHAIN: the ACCEPTED word NEWGROUNDS finds O.G. and stamps above the input`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await installBackendMock(page);
    await seed(page);
    await startChain(page);
    const first = await required(page);
    if (first !== 'n') await play(page, TO_N[first]);
    expect(await required(page)).toBe('n');
    await play(page, 'newgrounds');
    const stamp = page.getByTestId('unlisted-stamp');
    await expect(stamp).toBeVisible({ timeout: 5000 });
    await expect(stamp).toHaveAttribute('data-gear', 'mk-ul-og');
    await expect(page.getByTestId('unlisted-slot')).toBeVisible();
    expect(Object.keys(await owned(page))).toEqual(['mk-ul-og']);
    if (SHOTS) {
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${SHOTS}/chain-og-${vp.tag}.png` });
    }
  });
}

test('typing NEWGROUNDS without it being accepted finds nothing', async ({ page }) => {
  await installBackendMock(page);
  await seed(page);
  await startChain(page);
  const first = await required(page);
  if (first === 'n') await play(page, 'nation'); // the next letter is now N's successor, never N
  // type it into the box but let the game reject it (wrong letter), then type it again with no submit at all
  const input = page.locator('.solo-input');
  if ((await required(page)) !== 'n') {
    await input.fill('newgrounds');
    await input.press('Enter');
  }
  await input.fill('');
  for (const ch of 'newgrounds') await page.keyboard.press(ch);
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('unlisted-stamp')).toHaveCount(0);
  expect(await owned(page)).toEqual({});
});
