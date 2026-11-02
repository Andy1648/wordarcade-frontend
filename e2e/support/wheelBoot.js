// e2e/support/wheelBoot.js — the seeded season-2 save + the mocked 067_daily_wheel.sql RPCs the daily-wheel specs share.
import { installBackendMock } from './backendMock.js';
import { mockBoard } from './boardMock.js';

const SECRET = 'e'.repeat(48);
const SPIN_ID = '11111111-2222-4333-8444-555555555555';
const TICKET_ID = '99999999-8888-4777-8666-555555555555';


export async function boot(page, { gems = 200, slot = 2, streak = 0, cosmetic = 'jackpot' } = {}) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-wh', username: 'Spinner', level: 24, rebirths: 2, lifetime_words: 400, lifetime_letters: 2000, wins_per_word: 0, econ: 13 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, season2: true });
  // the 067 mock: one spin per day per kind; the same row on every later ask
  const db = { spun: null, claimed: false, calls: { spin: 0, claim: 0, state: 0 } };
  const PAY = { 0: ['gems', 25], 1: ['xp', 10], 2: ['gems', 60], 3: ['ticket', 0], 4: ['wins', 10], 5: ['ticket', 0], 6: ['gems', 120], 7: ['cosmetic', 0] };
  const body = (day, again) => {
    const [prize, base] = PAY[slot];
    const hot = streak + 1 >= 3;
    const amount = prize === 'gems' && hot ? Math.round(base * 1.5) : base; // = 067's HOT streak
    return {
      ok: true, again, spin: SPIN_ID, day, kind: 'free', slot, prize, amount, streak: streak + 1, bonus: hot ? 'hot' : null,
      claimed: db.claimed, cosmetic: prize === 'cosmetic' ? cosmetic : null,
      ticket: prize === 'ticket' ? { id: TICKET_ID, tier: slot === 5 ? 'legendary' : 'rare' } : null,
    };
  };
  await page.route('https://lb.e2e.invalid/**/rpc/lb_wheel_*', async (route) => {
    const url = new URL(route.request().url());
    const p = JSON.parse(route.request().postData() || '{}');
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (url.pathname.endsWith('lb_wheel_state')) {
      db.calls.state += 1;
      return json({ ok: true, day: p.p_day, streak, last_day: p.p_day - 1, ad_on: false, free: db.spun ? body(db.spun, true) : null, ad: null });
    }
    if (url.pathname.endsWith('lb_wheel_spin')) {
      db.calls.spin += 1;
      const again = db.spun === p.p_day;
      db.spun = p.p_day;
      return json(body(p.p_day, again));
    }
    if (url.pathname.endsWith('lb_wheel_claim')) {
      db.calls.claim += 1;
      db.claimed = true;
      return json({ ok: true });
    }
    return route.fallback();
  });
  await page.addInitScript(({ secret, id, gems }) => {
    if (sessionStorage.getItem('wh.seeded')) return;
    sessionStorage.setItem('wh.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Spinner' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 24, f: 0.4, rc: 2, v: 10 }));
    localStorage.setItem('taw.s2.wins', '3200');
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: gems, mig: 1 }));
    localStorage.setItem('taw.reveal', 'all');
    for (const k of ['gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier', 'init']) localStorage.setItem(`taw.tut.${k}`, '1');
  }, { secret: SECRET, id: row.id, gems });
  await page.goto('/?portal=1&season2=1');
  await page.locator('.homepage-logo, .hp-m-title').first().waitFor();
  return db;
}
