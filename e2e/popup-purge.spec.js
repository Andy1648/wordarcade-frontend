// e2e/popup-purge.spec.js — P7 POPUP PURGE behind ?season2=1 (claude/SEASON2-QUEUE.md P7; KitLevelUp.dc.html).
//
// "Remove every centre-screen popup and every menu claim notification (incl. 'claimed wins' toasts). Rank-ups pay
// nothing (status only, the top-edge banner). Unlocks = edge toasts. Gains = motion on the bar/counters.
// Achievements page is the only claim place."
//
// A page-side SAMPLER (every 80 ms, all through the action) flags:
//   * any [role=dialog] / [role=alertdialog] / [aria-modal=true] that is on screen;
//   * any NEW large centred layer — a fixed/absolute element, visibly opaque, 1.5–60% of the viewport, its centre in
//     the middle of the screen — whose class signature was NOT already on the settled menu before the action (the
//     menu's background WALL art is not a layer: its pieces re-form across the screen at LV100, by design);
//   * any menu claim notification (.claim-pop, the REWARDS / STATS count) or "claimed wins" toast (.wct-row).
// The detector is proven NOT vacuous by the flag-OFF control at the bottom: the live level-up DOES trip it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, isPhoneMenu } from './support/menu.js';

const SAMPLER = () => {
  window.__purge = { armed: false, base: new Set(), hits: [], dialogs: [], claims: [] };
  const sig = (el) => `${el.tagName}.${String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className).trim()}`;
  const opacityOf = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity) || 0;
    return o;
  };
  const centred = () => {
    const vw = innerWidth;
    const vh = innerHeight;
    const out = [];
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      // the menu's WALL is background art (aria-hidden): its pieces re-form across the screen every 100 levels — that
      // re-form IS season 2's wall moment (only its centre LV stamp is purged, and that stamp is outside .wall-scene)
      if (el.closest('.wall-scene')) continue;
      const r = el.getBoundingClientRect();
      const area = (r.width * r.height) / (vw * vh);
      if (r.width < 100 || area < 0.015 || area > 0.6) continue;
      const cx = (r.left + r.right) / 2 / vw;
      const cy = (r.top + r.bottom) / 2 / vh;
      if (cx < 0.3 || cx > 0.7 || cy < 0.25 || cy > 0.75) continue;
      if (opacityOf(el) < 0.3) continue;
      out.push({ el, sig: sig(el), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
    }
    return out;
  };
  const tick = () => {
    const p = window.__purge;
    if (p.skip && document.querySelector(p.skip)) return; // still on the screen we are leaving
    try {
      const found = centred();
      if (!p.armed) {
        for (const f of found) p.base.add(f.sig);
      } else {
        for (const f of found) if (!p.base.has(f.sig) && p.hits.length < 20) p.hits.push(`${f.sig} @ ${f.box.join(',')}`);
        for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')) {
          const r = d.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && p.dialogs.length < 20) p.dialogs.push(sig(d));
        }
        for (const c of document.querySelectorAll('.claim-pop, .wct-row, .homepage-claim-count, .hp-m-count')) {
          if (p.claims.length < 20) p.claims.push(`${sig(c)}: ${c.textContent}`);
        }
      }
    } catch {
      /* mid-render */
    }
  };
  setInterval(tick, 80);
};

const arm = (page) => page.evaluate(() => { window.__purge.armed = true; });
const verdict = (page) => page.evaluate(() => ({ hits: window.__purge.hits, dialogs: window.__purge.dialogs, claims: window.__purge.claims }));

async function boot(page, { season2 = true, seed = {}, path = '/' } = {}) {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); // the real motion — every card / banner animates
  await installBackendMock(page);
  await page.addInitScript(SAMPLER);
  await page.addInitScript((seed) => {
    if (sessionStorage.getItem('pp.seeded')) return;
    sessionStorage.setItem('pp.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.econ', '12');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}portal=1${season2 ? '&season2=1' : ''}`);
}

// LV20, nearly through it — a few REAL WORDS typed anywhere cross LV21 (PROGRESSION FINAL: menu words only, ×0.2). R1
// since the last menu visit (the rank / unlocks last SEEN were R0's), so the menu owes a RANK UP (KEYMASH → TYPO) and
// AUTO ROLL (ROLL + INDEX is open from the start — never news).
const S2_SEED = {
  'taw.s2.xp': JSON.stringify({ lv: 20, f: 0.985, rc: 1, v: 10 }),
  'taw.s2.rebirths': '1',
  'taw.s2.rankShown': '0',
  'taw.s2.unlocksShown': '[]',
};

for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`SEASON2 @${vp.width}: rank-up = top-edge banner, unlock = edge toast, level-up = the bar — nothing centred, no dialog, no claim toast`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(vp);
    // The page is seeded with the rank news already owed, so the sampler must be ARMED from the first frame: the
    // settled-menu baseline is taken from a control load of the same save with the news already said.
    await boot(page, { seed: { ...S2_SEED, 'taw.s2.rankShown': '1', 'taw.s2.unlocksShown': '["autoRoll"]' } });
    await menuReady(page);
    await page.waitForTimeout(1500); // the settled menu: what is centred here is the menu itself
    const base = await page.evaluate(() => [...window.__purge.base]);
    // the same save, with the news owed — the sampler is armed on the base above from the first frame
    await page.evaluate(() => {
      localStorage.setItem('taw.s2.rankShown', '0');
      localStorage.setItem('taw.s2.unlocksShown', '[]');
    });
    await page.addInitScript((base) => {
      const go = () => {
        if (!window.__purge) { setTimeout(go, 5); return; }
        for (const s of base) window.__purge.base.add(s);
        window.__purge.armed = true;
      };
      go();
    }, base);
    await page.reload();
    await menuReady(page);

    // RANK UP: drops from the TOP edge with the v3 names, pays nothing
    const banner = page.locator('.krb');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toHaveAttribute('data-rank', 'TYPO');
    await expect(banner.locator('.krb-plate.is-old')).toHaveText('KEYMASH');
    await expect(banner.locator('.krb-plate.is-new')).toHaveText('TYPO');
    await expect(banner.locator('.krb-code')).toHaveText('R1');
    await page.waitForTimeout(700); // past the 0.5 s drop
    const bb = await banner.boundingBox();
    expect(bb.y, 'the banner hangs from the top edge').toBeLessThanOrEqual(2);
    expect(bb.y + bb.height, 'and stays in the top band').toBeLessThan(vp.height * 0.2);
    // UNLOCK: a right-edge toast
    const toast = page.locator('.ket-card[data-toast="R1"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('AUTO ROLL');
    const tb = await toast.boundingBox();
    expect(Math.round(tb.x + tb.width), 'the toast sits on the right edge').toBeGreaterThanOrEqual(vp.width - 2);
    expect(await page.evaluate(() => localStorage.getItem('taw.s2.wins')), 'a rank-up pays no wins').toBeNull();
    expect(await page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0), 'a rank-up pays no gems').toBe(0);

    // LEVEL UP: LV20 → LV21 by typing real words on the menu — the bar wraps; no LEVEL card, no NEW WALL stamp
    await expect.poll(async () => {
      await page.keyboard.type('house garden window ', { delay: 130 });
      return page.evaluate(() => window.__tawXp().level);
    }, { timeout: 20_000 }).toBeGreaterThanOrEqual(21);
    await page.waitForTimeout(isPhoneMenu(page) ? 2500 : 4500); // every queued moment (wall 1.8 s + its fx, tier-up) has played
    const v = await verdict(page);
    expect(v.dialogs, 'no dialog').toEqual([]);
    expect(v.hits, 'nothing large appears in the middle of the screen').toEqual([]);
    expect(v.claims, 'no menu claim notification / claimed-wins toast').toEqual([]);
    await expect(page.locator('.menu-xp-levelup')).toHaveCSS('opacity', '0');
  });
}

// CHAIN, deterministically (the no-hidden-wins-solo.spec.js driver): one opener per required letter, then words that
// all end in E, so every link needs an E.
const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future',
  g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice',
  o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where',
};
const E_WORDS = ['estate', 'elite', 'escape', 'expense', 'example', 'everyone'];

test('SEASON2: played words (a WINS gain + the TYPE WORDS I unlock) → the menu shows no stamp / toast / claim; ACHIEVEMENTS claims', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  // 96 season words: five CHAIN links make TYPE WORDS I (100) ready, and pass CHAIN's 3-word "start earning" gate
  await boot(page, {
    seed: { 'taw.s2.count': JSON.stringify({ words: 96 }), 'taw.s2.rankShown': '0', 'taw.s2.unlocksShown': '[]', 'taw.chain.runs': '5', 'taw.seenTeach.chain': '1', 'taw.seenGameSpotlight': '1' },
  });
  // the settled menu's own centred layout (the cards, the logo …) = the baseline for the return below
  await menuReady(page);
  await page.waitForTimeout(1500);
  const menuBase = await page.evaluate(() => [...window.__purge.base]);
  await page.goto('/?chain=1&portal=1&season2=1');
  const input = page.locator('.solo-input');
  await input.waitFor({ state: 'visible', timeout: 20_000 });
  await arm(page); // the game's own layout is the baseline; a claimed-wins toast mid-run would show up here
  const pool = [...E_WORDS];
  for (let i = 0; i < 5; i += 1) {
    const letter = (await page.locator('.solo-center').first().innerText()).trim().toLowerCase().slice(0, 1);
    await input.fill(i === 0 ? OPENER_WORD[letter] : pool.shift());
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  }
  await expect.poll(() => page.evaluate(() => Number(localStorage.getItem('taw.s2.wins')) || 0), { timeout: 8000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.count') || '{}').words) || 0)).toBeGreaterThanOrEqual(100);
  expect((await verdict(page)).claims, 'no claimed-wins toast in the game either').toEqual([]);
  // back to the menu, ARMED against the settled-menu baseline: the live game says this with a centre "+N WINS" stamp;
  // season 2 must not
  await page.evaluate((b) => { Object.assign(window.__purge, { base: new Set(b), hits: [], dialogs: [], claims: [], armed: true, skip: '.solo-root' }); }, menuBase);
  await page.locator('.solo-exit').click();
  await menuReady(page);
  await page.waitForTimeout(2500);
  expect((await verdict(page)).hits, 'nothing large appears in the middle of the menu').toEqual([]);
  const v = await verdict(page);
  expect(v.dialogs).toEqual([]);
  expect(v.claims, 'no menu claim notification / claimed-wins toast').toEqual([]);
  // the gain is MOTION ON THE COUNTER: the wins pill counts up with its own +N (no centre "+N WINS" stamp)
  await expect(page.locator('.menu-xp-winsstamp')).toHaveCSS('opacity', '0');
  await expect(page.locator('.menu-xp-winshint')).toHaveCSS('opacity', '0');
  const wins = await page.evaluate(() => Number(localStorage.getItem('taw.s2.wins')));
  await expect(page.locator('.menu-wins-chip').first()).toHaveAttribute('data-value', String(wins));

  // the ONLY claim place: ACHIEVEMENTS (TYPE WORDS I → +40 gems)
  await page.locator('.homepage-nav-btn.is-ach').click();
  const ach = page.locator('.av3-overlay');
  await ach.waitFor({ state: 'visible' });
  const type = ach.locator('[data-ach="type"]');
  await expect(type.locator('.av3-strip')).toContainText('READY!');
  const gems0 = await page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0);
  await type.locator('.av3-claim').click();
  await expect.poll(() => page.evaluate(() => (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0)).toBe(gems0 + 40);
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.ach'))).toBe('{"type":1}');
});

test('flag OFF (control): the live level-up still paints its centre LEVEL card — the detector is not vacuous', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await boot(page, { season2: false, seed: { 'taw.xp': JSON.stringify({ lv: 3, f: 0.97, rc: 0, v: 10 }) } });
  await menuReady(page);
  await page.waitForTimeout(1500);
  await arm(page);
  for (let i = 0; i < 4; i++) await page.keyboard.type('qwertyuiop', { delay: 60 });
  await expect.poll(() => page.evaluate(() => window.__tawXp().level), { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  await expect.poll(async () => (await verdict(page)).hits.join(' | '), { timeout: 5000 }).toContain('menu-xp-levelup');
});
