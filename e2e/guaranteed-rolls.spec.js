// e2e/guaranteed-rolls.spec.js — 060 GUARANTEED ROLLS (Andy oct22 "no source code bs"). A ticket is the SERVER's: the
// ROLL screen shows OPEN LEGENDARY+ ROLL (a cog-locked vessel, 065) only for a ticket lb_tickets lists, spends it through lb_ticket_roll (the
// browser sends only the ticket id — never a tier or luck), lands the server's pick with the full reveal, claims it,
// costs no gems and leaves the pity countdown alone. A forged local ticket / a forged reply row / a pick below the
// floor never renders or lands.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady } from './support/menu.js';

const SECRET = 'd7'.repeat(24);
const TID = '0b6f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
async function boot(page, { tickets = [{ id: TID, tier: 'legendary', state: 'owned', source: 'streak' }], pick = { mark: 'mk-eclipse', tier: 'legendary', shiny: false } } = {}) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  const me = { id: 'me', username: 'TIXME', level: 30, rebirths: 0, stars: 0, lifetime_words: 100 };
  await mockBoard(page, [], { caps: true, econ: true, boardEcon: true, season2: true, shared: { rows: [me], secrets: new Map([[SECRET, 'me']]), saves: new Map() } }).catch(() => {});
  const calls = { list: 0, roll: [], claim: [] };
  let spent = false;
  await page.route('**/rpc/lb_pity', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, since_epic: 3, since_leg: 20, rolls: 40 }) }));
  await page.route('**/rpc/lb_roll', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, seq: 1, picks: [{ mark: 'mk-detonator', tier: 'rare', shiny: false }], since_epic: 3, since_leg: 20 }) }));
  await page.route('**/rpc/lb_tickets', (route) => {
    calls.list += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, tickets: spent ? [] : tickets, streak: null }) });
  });
  await page.route('**/rpc/lb_ticket_roll', (route) => {
    calls.roll.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ticket: TID, tier: 'legendary', pick }) });
  });
  await page.route('**/rpc/lb_ticket_claim', (route) => {
    calls.claim.push(JSON.parse(route.request().postData() || '{}'));
    spent = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ticket: TID }) });
  });
  await page.addInitScript(({ secret }) => {
    if (sessionStorage.getItem('gr.seeded')) return;
    sessionStorage.setItem('gr.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'TIXME' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 30, f: 0.2, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 5000, mig: 1 }));
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.markRolls', JSON.stringify({ v: 3, rolls: 40, sinceEpic: 3, sinceLegendary: 20, everEpic: true, starter: true, marks: {}, milestones: [] }));
    // a FORGED local ticket (what a console user would try): the screen must never read it
    localStorage.setItem('taw.s2.tickets', JSON.stringify([{ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', tier: 'mythic', state: 'owned' }]));
  }, { secret: SECRET });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  return calls;
}
const gems = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.gems')).bal);
const save = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls')));

test('OPEN LEGENDARY+ ROLL: the sealed vessel opens on the server pick, free, pity untouched, claimed once', async ({ page }) => {
  const calls = await boot(page);
  const btn = page.getByTestId('roll-ticket');
  await expect(btn).toBeVisible({ timeout: 6000 });
  await expect(btn).toContainText('LEGENDARY+');
  await expect(btn).toHaveAttribute('data-tier', 'legendary');
  await expect(btn.locator('.va img.va-cog')).toHaveAttribute('src', /vessel-legendary-cog/); // a vessel, never a die
  const gems0 = await gems(page);
  await btn.click();
  const sealed = page.getByTestId('sealed-roll');
  await expect(sealed).toHaveAttribute('data-phase', 'sealed');
  expect(calls.roll, 'nothing is asked before OPEN').toHaveLength(0);
  await page.getByTestId('sealed-roll-open').click();
  await expect(sealed).toHaveAttribute('data-phase', 'open', { timeout: 8000 });
  await expect(sealed).toHaveAttribute('data-tier', 'legendary');
  await expect(page.getByTestId('sealed-roll-card')).toBeVisible();
  expect(calls.roll).toHaveLength(1);
  expect(Object.keys(calls.roll[0]).sort()).toEqual(['p_secret', 'p_ticket']); // never a tier, never luck
  expect(calls.roll[0].p_ticket).toBe(TID);
  await expect.poll(() => calls.claim.length).toBe(1);
  expect(await gems(page)).toBe(gems0); // free
  const st = await save(page);
  expect(st.marks['mk-eclipse'].n).toBe(1);
  expect(st.rolls).toBe(40);
  expect(st.sinceEpic).toBe(3);
  expect(st.sinceLegendary).toBe(20); // pity untouched
  await page.getByTestId('sealed-roll-done').click();
  await expect(sealed).toHaveCount(0);
  await expect(page.getByTestId('roll-pity')).toContainText('LEGENDARY+ IN 40'); // 60 − 20 (hard pity 60, oct22)
  await expect(btn).toHaveCount(0); // spent: the server no longer lists it
});

test('ADVERSARIAL: no server ticket → no button (a forged local ticket and forged reply rows are ignored)', async ({ page }) => {
  await boot(page, { tickets: [
    { id: TID, tier: 'secret', state: 'owned' }, // no SECRET+ tickets exist
    { id: 'not-a-uuid', tier: 'mythic', state: 'owned' },
    { id: TID, tier: 'legendary', state: 'spent' },
  ] });
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('roll-ticket')).toHaveCount(0);
});

test('ADVERSARIAL: a spend reply below the ticket floor lands nothing and spends no claim', async ({ page }) => {
  const calls = await boot(page, { pick: { mark: 'mk-detonator', tier: 'rare', shiny: false } });
  await page.getByTestId('roll-ticket').click();
  await page.getByTestId('sealed-roll-open').click();
  await expect(page.getByTestId('sealed-roll')).toHaveAttribute('data-phase', 'later', { timeout: 8000 }); // stays sealed, waits in GEARS
  await expect(page.getByTestId('sealed-roll-card')).toHaveCount(0);
  expect(calls.claim).toHaveLength(0);
  const st = await save(page);
  expect(st.marks['mk-detonator']).toBeUndefined();
});
