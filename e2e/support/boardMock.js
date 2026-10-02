// e2e/support/boardMock.js — the leaderboard's REST API, mocked (the e2e build points
// VITE_SUPABASE_URL at lb.e2e.invalid — see playwright.config.js). A tiny in-memory board that applies
// the DB's name rules via the CLIENT filter (DB/client parity is pinned by claude/step24/db-parity.mjs).
// Ranking matches the view: rebirths, level, lifetime words, then first-come (stable sort).
import { isNameBlocked } from '../../src/leaderboard/nameFilter.js';

// `caps` emulates supabase/migrations/005_letters_cjk.sql (STEP 51): lb_caps answers, lb_submit2
// carries letters; the board ranks by lifetime_words either way (Andy oct2, 009). Without it the mock is the v1 DB (lb_caps 404s).
export async function mockBoard(page, seed = [], { caps = false, shared = null } = {}) {
  // `shared` lets two pages / contexts (a "new device") see the same DB.
  const db = shared || { rows: seed.map((r) => ({ lifetime_letters: (r.lifetime_words || 0) * 5, ...r })), secrets: new Map(), saves: new Map() };
  const rows = db.rows;
  const secrets = db.secrets;
  const saves = db.saves; // 006_cloud_save.sql: secret's profile id → { blob, score }
  const calls = { claim: 0, submit: 0 };
  const ranked = () => rows
    .slice()
    // the production view (009_board_by_words.sql): lifetime words, then level, then rebirths
    .sort((a, b) => b.lifetime_words - a.lifetime_words || b.level - a.level || b.rebirths - a.rebirths)
    .map((r, i) => {
      const out = { ...r, rank: i + 1 };
      if (!caps) delete out.lifetime_letters;
      return out;
    });
  await page.route('https://lb.e2e.invalid/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    if (url.pathname.endsWith('/rpc/lb_caps')) {
      return caps ? json(200, { letters: true, cjk: true, cloud: true }) : json(404, { message: 'Could not find the function public.lb_caps' });
    }
    if (caps && url.pathname.endsWith('/rpc/lb_save')) {
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      const old = saves.get(pid);
      if (old && BigInt(body.p_score) < BigInt(old.score)) return json(200, { saved: false, reason: 'lower' });
      saves.set(pid, { blob: body.p_blob, score: String(body.p_score) });
      return json(200, { saved: true });
    }
    if (caps && url.pathname.endsWith('/rpc/lb_load')) {
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      const row = rows.find((r) => r.id === pid);
      const sv = saves.get(pid);
      return json(200, { id: pid, username: row && row.username, blob: sv ? sv.blob : null, score: sv ? sv.score : 0 });
    }
    if (caps && url.pathname.endsWith('/rpc/lb_submit2')) {
      calls.submit += 1;
      const row = rows.find((r) => r.id === secrets.get(body.p_secret));
      if (!row) return json(404, { message: 'no_profile' });
      Object.assign(row, {
        level: body.p_level,
        rebirths: body.p_rebirths,
        lifetime_words: body.p_lifetime_words,
        lifetime_letters: body.p_lifetime_letters,
        wins_per_word: body.p_wins_per_word,
      });
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.endsWith('/rpc/lb_name_status')) {
      const n = body.p_username;
      if (isNameBlocked(n)) return json(200, 'blocked');
      return json(200, rows.some((r) => r.username.toLowerCase() === n.toLowerCase()) ? 'taken' : 'ok');
    }
    if (url.pathname.endsWith('/rpc/lb_claim')) {
      calls.claim += 1;
      const n = body.p_username;
      if (isNameBlocked(n)) return json(400, { message: 'username_blocked' });
      const mine = secrets.get(body.p_secret);
      if (rows.some((r) => r.username.toLowerCase() === n.toLowerCase() && r.id !== mine)) return json(409, { message: 'username_taken' });
      let row = rows.find((r) => r.id === mine);
      if (!row) {
        row = { id: `id-${rows.length + 1}`, username: n, level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0 };
        rows.push(row);
        secrets.set(body.p_secret, row.id);
      } else {
        row.username = n;
      }
      return json(200, row);
    }
    if (url.pathname.endsWith('/rpc/lb_submit')) {
      calls.submit += 1;
      const row = rows.find((r) => r.id === secrets.get(body.p_secret));
      if (!row) return json(404, { message: 'no_profile' });
      Object.assign(row, {
        level: body.p_level,
        rebirths: body.p_rebirths,
        lifetime_words: body.p_lifetime_words,
        wins_per_word: body.p_wins_per_word,
      });
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.endsWith('/leaderboard')) {
      const id = url.searchParams.get('id');
      const all = ranked();
      return json(200, id ? all.filter((r) => `eq.${r.id}` === id) : all.slice(0, Number(url.searchParams.get('limit') || 100)));
    }
    return json(404, { message: 'not mocked' });
  });
  return { rows, calls, secrets, saves, db };
}
