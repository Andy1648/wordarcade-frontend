// e2e/kit.spec.js — the v2 KIT, driven through its dev-only gallery (/?kit=1, compiled into the e2e
// build by VITE_KIT_GALLERY=1; absent from production). Covers what unit tests cannot: real pointer
// and keyboard holds, the disabled press, keyboard tabs + toggles, the XP climb on a real clock,
// REDUCE MOTION, no infinite animations, and the 13px text floor.
import { test, expect } from '@playwright/test';

async function open(page, { reduce = false } = {}) {
  await page.addInitScript((r) => {
    try {
      localStorage.setItem('taw.reduceMotion', r ? '1' : '0');
    } catch { /* blocked */ }
  }, reduce);
  await page.goto('/?kit=1');
  await page.locator('.kg-sheet--icons').waitFor();
  await page.evaluate(() => document.fonts.ready);
}
const num = async (loc) => Number((await loc.textContent()).trim());

test('hold-to-confirm commits only after the full hold (pointer + keyboard)', async ({ page }) => {
  await open(page);
  const hold = page.getByTestId('kit-hold');
  const commits = page.getByTestId('kit-hold-commits');
  const cancels = page.getByTestId('kit-hold-cancels');
  await hold.scrollIntoViewIfNeeded();
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // let go early → cancel, never a commit
  await page.mouse.down();
  await page.waitForTimeout(500);
  await expect(hold).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await page.waitForTimeout(800);
  expect(await num(commits)).toBe(0);
  expect(await num(cancels)).toBe(1);

  // hold through → exactly one commit
  await page.mouse.down();
  await page.waitForTimeout(1250);
  await page.mouse.up();
  expect(await num(commits)).toBe(1);

  // keyboard: Space held short = cancel; Space / Enter held long = commit
  await hold.focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await page.waitForTimeout(700);
  expect(await num(commits)).toBe(1);
  await page.keyboard.down('Space');
  await page.waitForTimeout(1250);
  await page.keyboard.up('Space');
  expect(await num(commits)).toBe(2);
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1250);
  await page.keyboard.up('Enter');
  expect(await num(commits)).toBe(3);
});

test('a disabled button cannot be pressed — it denies instead', async ({ page }) => {
  await open(page);
  const btn = page.getByTestId('kit-disabled');
  await expect(btn).toHaveAttribute('aria-disabled', 'true');
  await btn.click({ force: true }); // aria-disabled stays tappable on purpose (the deny feedback)
  await btn.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(await num(page.getByTestId('kit-disabled-clicks'))).toBe(0);
  expect(await num(page.getByTestId('kit-disabled-denies'))).toBe(3);
});

test('toggles and tabs work by keyboard', async ({ page }) => {
  await open(page);
  const sw = page.getByRole('switch', { name: 'Reduce motion' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('kit-rm-state')).toHaveText(/ON/);
  await page.keyboard.press('Enter');
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  const range = page.getByRole('tablist', { name: 'Time range' });
  const allTime = range.getByRole('tab', { name: 'ALL TIME' });
  const week = range.getByRole('tab', { name: 'THIS WEEK' });
  await expect(allTime).toHaveAttribute('aria-selected', 'true');
  await allTime.focus();
  await page.keyboard.press('ArrowRight');
  await expect(week).toHaveAttribute('aria-selected', 'true');
  await expect(week).toBeFocused();
  await expect(allTime).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('Home');
  await expect(allTime).toHaveAttribute('aria-selected', 'true');

  const rank = page.getByRole('tablist', { name: 'Rank by' });
  await rank.getByRole('tab', { name: 'WINS' }).focus();
  await page.keyboard.press('End');
  await expect(rank.getByRole('tab', { name: 'REBIRTHS' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(rank.getByRole('tab', { name: 'XP' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.kg-lrow-v').first()).toHaveClass(/kg-c-cyan/);
});

test('the XP climb (+30 levels) finishes within 1 s', async ({ page }) => {
  await open(page);
  const xp = page.locator('.kx');
  await page.getByRole('button', { name: '+50 STRESS' }).click();
  await expect(xp).toHaveAttribute('data-state', 'rest', { timeout: 3000 });
  const ms = Number(await xp.getAttribute('data-climb-ms'));
  expect(ms, `climb took ${ms} ms`).toBeGreaterThan(0);
  expect(ms, `climb took ${ms} ms`).toBeLessThanOrEqual(1000);
  await expect(page.getByTestId('kit-xp-last')).toHaveText(/^\+30 LV IN (0\.\d\d|1\.00)S$/);
});

test('a burst of gains is one continuous glide — the fill climbs, resetting to 0 only at a wrap', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const root = document.querySelector('.kg-xp');
    const fill = root.querySelector('.kx-fill');
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+1 LETTER');
    const scale = () => {
      const m = /scaleX\(([^)]+)\)/.exec(fill.style.transform || '');
      return m ? Number(m[1]) : NaN;
    };
    const lv = () => Number(root.dataset.level); // the numeral is compacted (1.24M) — data-level is exact
    const startLv = lv();
    const samples = [];
    let on = true;
    const tick = () => {
      samples.push({ l: lv(), s: scale() });
      if (on) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (let i = 0; i < 8; i += 1) {
      btn.click();
      await sleep(60);
    }
    await sleep(1200);
    on = false;
    return { startLv, samples, endLv: lv(), state: root.dataset.state, sweep: !!root.querySelector('.kx-sweep') };
  });
  expect(r.sweep, 'the one pooled sweep node').toBe(true);
  let wraps = 0;
  for (let i = 1; i < r.samples.length; i += 1) {
    const a = r.samples[i - 1];
    const b = r.samples[i];
    if (b.l === a.l) expect(b.s, `frame ${i}: ${a.s} → ${b.s} went backwards inside LV ${a.l}`).toBeGreaterThanOrEqual(a.s);
    else {
      wraps += 1;
      expect(b.l).toBeGreaterThan(a.l);
      expect(b.s, 'a reset happens only at a wrap').toBeLessThan(a.s);
    }
  }
  // 8 × 0.6 of a level = 4.8 levels: every level crossed shows as a wrap, never a jump past it
  expect(r.endLv - r.startLv).toBe(wraps);
  expect(wraps).toBeGreaterThanOrEqual(4);
  expect(r.state).toBe('rest');
});

test('REDUCE MOTION makes everything land instantly', async ({ page }) => {
  await open(page, { reduce: true });
  await expect(page.getByTestId('kit-rm-state')).toHaveText(/ON/);
  // count-up: the number is the new value the same frame
  const pill = page.locator('.kp').filter({ has: page.locator('.kp-name', { hasText: 'GEMS' }) }).first();
  await page.getByTestId('kit-gain-gems').click();
  const label = await pill.getAttribute('aria-label');
  const target = label.replace(/^GEMS\s+/, '');
  expect(await pill.locator('.kp-num').textContent()).toBe(target);
  // the XP climb lands with no climb at all
  await page.getByRole('button', { name: '+50 STRESS' }).click();
  await expect(page.locator('.kx')).toHaveAttribute('data-state', 'rest');
  expect(await page.locator('.kx').getAttribute('data-climb-ms')).toBe('0');
  // pops, stamps, banners, the deny shake — nothing animates
  await page.getByRole('button', { name: /OVERDRIVE/ }).filter({ has: page.locator('.kg-tier-l') }).click();
  await page.getByTestId('kit-spend-wins').click();
  await page.getByRole('button', { name: 'Replay CLAIMED stamp' }).click();
  await page.getByRole('button', { name: 'Beat bot, collect 75 gems' }).click();
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === 'running' && !(a instanceof CSSTransition)).length);
  expect(running, 'running animations with reduce motion on').toBe(0);
  // informational one-shots still SHOW (still), they just do not move
  await expect(page.locator('.kp-need.kit-static-on')).toHaveText(/NEED .* MORE/);
});

test('no infinite animations anywhere in the kit', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /OVERDRIVE/ }).filter({ has: page.locator('.kg-tier-l') }).click();
  await page.getByRole('button', { name: /MYTHIC ROLL/ }).click();
  await page.getByRole('button', { name: 'Beat bot, collect 75 gems' }).click();
  await page.getByRole('button', { name: '+50 STRESS' }).click();
  await page.getByRole('button', { name: '→ 3 LEFT' }).click();
  await page.locator('#bars').getByRole('button', { name: 'ROLL', exact: true }).click();
  await page.waitForTimeout(1200);
  const infinite = await page.evaluate(() => {
    const waapi = document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity).length;
    let css = 0;
    for (const el of document.querySelectorAll('.kg *')) if (getComputedStyle(el).animationIterationCount.includes('infinite')) css += 1;
    return { waapi, css };
  });
  expect(infinite).toEqual({ waapi: 0, css: 0 });
  // and at rest (after every one-shot ends) nothing is left animating but the ticking timers' glides
  await page.waitForTimeout(3500);
  const left = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === 'running' && !(a instanceof CSSTransition)).length);
  expect(left).toBe(0);
});

for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`all kit text is ≥ 13px (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize(vp);
    await open(page);
    const small = await page.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.querySelector('.kg'), NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!/[A-Za-z0-9]/.test(n.nodeValue)) continue;
        const el = n.parentElement;
        if (!el || el.closest('.kg-sr')) continue;
        if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 13) out.push(`${fs}px "${n.nodeValue.trim().slice(0, 30)}" <${el.tagName.toLowerCase()} class="${el.getAttribute('class')}">`);
      }
      return out;
    });
    expect(small).toEqual([]);
    const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal page scroll').toBeLessThanOrEqual(0);
  });
}
