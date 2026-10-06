// e2e/menu-hook.spec.js — feat/type-a-word-hook: the phone menu's first-visit "TYPE A WORD 👇".
//
// The visitors searching "type a word" land on a phone and bounce. A first-timer's phone menu now
// opens with the site's name as an instruction and an input; any word slams in as the house
// letterform while the mascot reacts, then ONE tap starts a solo Word Bomb round.
//
// Asserted at 390x844, 360x640 and 320x568 (the tightest phone the app supports):
//   - the menu is still ONE screen: no vertical/horizontal scroll, every mode row + the foot in view,
//     in the ask state AND after the reaction,
//   - no text under 13px in the hook, and every control in it is a 44px target,
//   - the reaction adds ZERO infinite animations (the mascot's idle loop is off inside the hook),
//   - one tap on PLAY SOLO sends the solo Word Bomb frames (private room, CHILL for a first-timer).
// Plus: German browsers get "TIPP EIN WORT 👇"; returning players and desktop never see the hook.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, PHONE_MODE_IDS } from './support/menu.js';

const PHONES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];

async function openMenu(page, { played = false } = {}) {
  const mock = await installBackendMock(page);
  await page.addInitScript((wasPlayed) => {
    try {
      if (wasPlayed) localStorage.setItem('wa_has_played', '1');
      else localStorage.removeItem('wa_has_played');
    } catch { /* storage blocked */ }
  }, played);
  await page.goto('/?portal=1');
  await menuReady(page);
  return mock;
}

// One screen, nothing under 13px in the hook, every hook control >= 44px.
function measure(page) {
  return page.evaluate((ids) => {
    const vh = innerHeight;
    const vw = innerWidth;
    const de = document.documentElement;
    const inView = (el) => {
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.top >= -0.5 && b.bottom <= vh + 0.5 && b.left >= -0.5 && b.right <= vw + 0.5;
    };
    const hook = document.querySelector('.hp-m-hook');
    const small = hook
      ? [hook, ...hook.querySelectorAll('*')]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent)))
        .filter((el) => getComputedStyle(el).opacity !== '0')
        .map((el) => `${el.className}:${parseFloat(getComputedStyle(el).fontSize)}`)
        .filter((s) => parseFloat(s.split(':').pop()) < 13)
      : ['no hook'];
    const targets = hook
      ? [...hook.querySelectorAll('button, input')].map((el) => {
        const b = el.getBoundingClientRect();
        return { cls: el.className, w: Math.round(b.width), h: Math.round(b.height), inView: inView(el) };
      })
      : [];
    return {
      vScroll: de.scrollHeight > vh + 1 || document.body.scrollHeight > vh + 1,
      hScroll: de.scrollWidth > vw + 1,
      rowsInView: ids.map((id) => inView(document.querySelector(`.hp-m-row--${id}`))),
      footInView: inView(document.querySelector('.hp-m-rail')), // v2 menu: the rail (pills + CREDITS + nav) is the foot
      small,
      targets,
    };
  }, PHONE_MODE_IDS);
}

const infiniteCount = (page) =>
  page.evaluate(() => document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.getTiming && a.effect.getTiming();
    return t && t.iterations === Infinity;
  }).length);

function expectOneScreen(m, label) {
  expect(m.vScroll, `${label}: no vertical scroll`).toBe(false);
  expect(m.hScroll, `${label}: no horizontal scroll`).toBe(false);
  expect(m.rowsInView, `${label}: every mode row in view`).toEqual(PHONE_MODE_IDS.map(() => true));
  expect(m.footInView, `${label}: foot in view`).toBe(true);
  expect(m.small, `${label}: no text under 13px in the hook`).toEqual([]);
  for (const t of m.targets) {
    expect(t.h, `${label}: ${t.cls} height`).toBeGreaterThanOrEqual(44);
    expect(t.w, `${label}: ${t.cls} width`).toBeGreaterThanOrEqual(44);
    expect(t.inView, `${label}: ${t.cls} on screen`).toBe(true);
  }
}

for (const vp of PHONES) {
  test(`${vp.width}x${vp.height} first-timer: type a word -> slam + mascot -> one tap into solo Word Bomb`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await openMenu(page);

    const ask = page.locator('.hp-m-hook-ask');
    await expect(ask).toHaveText('TYPE A WORD 👇');
    await expect(page.locator('.hp-m-hook-input')).toBeVisible();
    // Nothing is typed into, focused or popped open for them: no auto-raised keyboard.
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe('hp-m-hook-input');
    expectOneScreen(await measure(page), 'ask');

    const loopsBefore = await infiniteCount(page);
    await page.locator('.hp-m-hook-input').pressSequentially('banana');
    await page.keyboard.press('Enter');

    await expect(page.locator('.hp-m-hook-word')).toBeVisible();
    await expect(page.locator('.hp-m-hook-again')).toHaveAttribute('aria-label', /^BANANA/);
    await expect(page.locator('.hp-m-hook .mascot-container')).toBeVisible();
    const play = page.locator('.hp-m-hook-play');
    await expect(play).toBeVisible();
    await page.waitForTimeout(800); // slam + CTA entrance finished
    expectOneScreen(await measure(page), 'reaction');
    expect(await infiniteCount(page), 'the reaction adds no infinite animation').toBe(loopsBefore);

    // ONE tap: straight into the solo Word Bomb path (same frames as the dialog's PLAY SOLO).
    await play.click();
    const create = await mock.waitForSent('create_room', 10000);
    expect(create.payload.isPublic, 'create_room is PRIVATE').toBe(false);
    await expect.poll(() => mock.sentTypes().filter((t) => ['create_room', 'set_game_type', 'set_difficulty', 'add_bot'].includes(t)))
      .toEqual(['create_room', 'set_game_type', 'set_difficulty', 'add_bot']);
    const frames = mock.sentFrames();
    expect(frames.find((f) => f.type === 'set_game_type').payload.gameType).toBe('word-bomb');
    expect(frames.find((f) => f.type === 'set_difficulty').payload.difficultyKey).toBe('chill');
  });
}

test('the word can be retyped, and an empty submit does nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMenu(page);
  await page.locator('.hp-m-hook-input').pressSequentially('!!! 42');
  await page.keyboard.press('Enter');
  await expect(page.locator('.hp-m-hook-word')).toHaveCount(0);
  await expect(page.locator('.hp-m-hook-input')).toBeVisible();

  await page.locator('.hp-m-hook-input').pressSequentially('cat');
  await page.locator('.hp-m-hook-go').click();
  await expect(page.locator('.hp-m-hook-again')).toHaveAttribute('aria-label', /^CAT/);
  await page.locator('.hp-m-hook-again').click();
  await expect(page.locator('.hp-m-hook-input')).toBeFocused();
  await page.keyboard.type('Straßenbahnwagen'); // longer than the cap: the input stops at 12
  await expect(page.locator('.hp-m-hook-input')).toHaveValue('Straßenbahnw');
  await page.keyboard.press('Enter');
  await expect(page.locator('.hp-m-hook-again')).toHaveAttribute('aria-label', /^STRASSENBAHN —/);
});

test.describe('German browser', () => {
  test.use({ locale: 'de-DE' });
  test('the one-line prompt reads TIPP EIN WORT 👇', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openMenu(page);
    await expect(page.locator('.hp-m-hook-ask')).toHaveText('TIPP EIN WORT 👇');
    await expect(page.locator('.hp-m-hook-ask')).toHaveAttribute('lang', 'de');
  });
});

test('a returning player gets the normal phone menu (no hook)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMenu(page, { played: true });
  await page.waitForTimeout(300);
  await expect(page.locator('.hp-m-hook')).toHaveCount(0);
});

test('desktop never mounts the hook', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openMenu(page);
  await page.waitForTimeout(300);
  await expect(page.locator('.hp-m-hook')).toHaveCount(0);
});
