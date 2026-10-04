// e2e/ext-milestones.spec.js — MILESTONE MOMENTS (claude/specs/milestones.md), dormant behind
// flagOn('milestones'). A menu keystroke that levels 9 → 10 plays the existing MenuXp level-up card;
// with ?milestones=1 that card carries data-milestone="S" and the MILESTONE kicker, and with the flag
// off it carries no attribute at all (today's card, untouched). Modeled on e2e/menu-xp.spec.js.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function menuAtEndOfLv9(page, query) {
  await page.addInitScript(() => {
    try {
      // v10 shape: { lv, f (fraction into the level), rc (rebirths), v }. One +10 keystroke levels up.
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 9, f: 0.99999, rc: 0, v: 10 }));
    } catch { /* storage blocked */ }
  });
  await installBackendMock(page);
  await page.goto(`/?portal=1${query}`);
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
}

async function typeOneKeyAndReadCard(page) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })));
  return page.evaluate(() => {
    const card = document.querySelector('.menu-xp-levelup');
    const p = window.__tawXp ? window.__tawXp() : {};
    return {
      lv: Number(p.level) || 0,
      milestone: card ? card.getAttribute('data-milestone') : 'no-card',
      title: document.querySelector('.menu-xp-levelup-title')?.textContent,
      sub: document.querySelector('.menu-xp-levelup-sub')?.textContent,
      detail: document.querySelector('.menu-xp-levelup-detail')?.textContent,
      infinite: document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length,
    };
  });
}

test.describe('milestone moments (?milestones=1)', () => {
  test('flag on: the LV10 level-up card is a milestone', async ({ page }) => {
    await menuAtEndOfLv9(page, '&milestones=1');
    const infiniteBefore = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length);
    const r = await typeOneKeyAndReadCard(page);
    expect(r.lv).toBe(10);
    expect(r.milestone).toBe('S');
    expect(r.title).toBe('LEVEL 10');
    expect(r.sub).toBe('MILESTONE');
    expect(r.detail).toBe('LV 9 → LV 10');
    expect(r.infinite, 'a milestone adds no infinite animation').toBe(infiniteBefore);
  });

  test('flag off: the LV10 level-up card carries no data-milestone', async ({ page }) => {
    await menuAtEndOfLv9(page, '');
    const r = await typeOneKeyAndReadCard(page);
    expect(r.lv).toBe(10);
    expect(r.milestone).toBeNull();
    expect(r.sub).not.toBe('MILESTONE');
  });
});
