// e2e/support/boardMock.js — the leaderboard's REST API, mocked (the e2e build points
// VITE_SUPABASE_URL at lb.e2e.invalid — see playwright.config.js). A tiny in-memory board that applies
// the DB's name rules via the CLIENT filter (DB/client parity is pinned by claude/step24/db-parity.mjs).
// Ranking matches the view (017, Andy oct3 19:55): rebirths, level, lifetime words, then first-come (stable sort).
import { isNameBlocked } from '../../src/leaderboard/nameFilter.js';
import { decideSubmit } from '../../src/leaderboard/submitRules.js';

// `caps` emulates supabase/migrations/005_letters_cjk.sql (STEP 51): lb_caps answers, lb_submit2
// carries letters; the board ranks by REBIRTHS, then LEVEL, then words (017, Andy oct3 19:55). Without it the mock is the v1 DB (lb_caps 404s).
// `weekly` emulates 013_weekly_board.sql (BB3): lb_caps.weekly, a per-submit week_words counter (the
// first submit is a baseline), and the leaderboard_weekly view (week_words > 0, most first).
// `rules` applies the REAL write rule (017_board_reality.sql via src/leaderboard/submitRules.js — throttle,
// reset-baseline on a lower submit, rate checks, level clamp) to lb_submit2/3, on the Node clock; a row's
// `submitted_at` (ms) seeds when it last submitted (absent = never → the first submit is a baseline).
// Off by default: the older specs submit faster than the 5 s throttle and expect every push to land.
// `econ` emulates 016_econ_v10.sql (lb_caps.econ = 10; lb_submit3 / lb_save2 / lb_load2); lb_submit3 marks
// the row econ = 10. `boardEcon` emulates 017's board_econ cap + the views' `econ` column (default 0); without
// it, a select naming `econ` answers 400 like PostgREST does for an unknown column.
export async function mockBoard(page, seed = [], { caps = false, shared = null, weekly = false, selfReset = true, rules = false, econ = false, boardEcon = false } = {}) {
  // `shared` lets two pages / contexts (a "new device") see the same DB.
  const db = shared || { rows: seed.map((r) => ({ lifetime_letters: (r.lifetime_words || 0) * 5, ...r })), secrets: new Map(), saves: new Map() };
  const rows = db.rows;
  const secrets = db.secrets;
  const saves = db.saves; // 006_cloud_save.sql: secret's profile id → { blob, score }
  const calls = { claim: 0, submit: 0 };
  const ranked = () => rows
    .slice()
    // the production view (017, Andy oct3 19:55): REBIRTHS, then LEVEL, then lifetime words
    .sort((a, b) => (b.rebirths || 0) - (a.rebirths || 0) || b.level - a.level || b.lifetime_words - a.lifetime_words)
    .map((r, i) => {
      const out = { ...r, rank: i + 1, econ: r.econ || 0 };
      if (!caps) delete out.lifetime_letters;
      if (!boardEcon) delete out.econ;
      delete out.submitted_at;
      return out;
    });
  await page.route('https://lb.e2e.invalid/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    if (url.pathname.endsWith('/rpc/lb_caps')) {
      return caps
        ? json(200, { letters: true, cjk: true, cloud: true, ...(weekly ? { weekly: true } : {}), ...(econ ? { econ: 10 } : {}), ...(boardEcon ? { board_econ: true } : {}) })
        : json(404, { message: 'Could not find the function public.lb_caps' });
    }
    if (caps && (url.pathname.endsWith('/rpc/lb_save') || (econ && url.pathname.endsWith('/rpc/lb_save2')))) {
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      const old = saves.get(pid);
      if (old && BigInt(body.p_score) < BigInt(old.score)) return json(200, { saved: false, reason: 'lower' });
      saves.set(pid, { blob: body.p_blob, score: String(body.p_score) });
      return json(200, { saved: true });
    }
    if (caps && (url.pathname.endsWith('/rpc/lb_load') || (econ && url.pathname.endsWith('/rpc/lb_load2')))) {
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      const row = rows.find((r) => r.id === pid);
      const sv = saves.get(pid);
      return json(200, { id: pid, username: row && row.username, blob: sv ? sv.blob : null, score: sv ? sv.score : 0, reset_all: !!(row && row.reset_all) });
    }
    // 012_admin_reset.sql: only while flagged — store the (lower) fresh save, zero the row, clear the flag
    if (caps && url.pathname.endsWith('/rpc/lb_reset_ack')) {
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      const row = rows.find((r) => r.id === pid);
      calls.resetAck = (calls.resetAck || 0) + 1;
      if (!row || !row.reset_all) return json(200, { reset: false, reason: 'not_flagged' });
      saves.set(pid, { blob: body.p_blob, score: String(body.p_score) });
      Object.assign(row, { level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, week_words: 0, reset_all: false });
      return json(200, { reset: true });
    }
    // 014_self_reset.sql: flag yourself, then the 012 path above (selfReset:false = 014 not run → 404)
    if (caps && url.pathname.endsWith('/rpc/lb_self_reset')) {
      if (!selfReset) return json(404, { code: 'PGRST202', message: 'Could not find the function public.lb_self_reset' });
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      const row = rows.find((r) => r.id === pid);
      calls.selfReset = (calls.selfReset || 0) + 1;
      saves.set(pid, { blob: body.p_blob, score: String(body.p_score) });
      Object.assign(row, { level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, week_words: 0, reset_all: false });
      return json(200, { reset: true });
    }
    const v3 = caps && econ && url.pathname.endsWith('/rpc/lb_submit3');
    if (v3 && body.p_econ !== 10) return json(400, { message: 'old_client' });
    if (caps && rules && (v3 || url.pathname.endsWith('/rpc/lb_submit2'))) {
      // 017's rule, exactly (src/leaderboard/submitRules.js). With `econ`, lb_submit2 is 016's no-op.
      calls.submit += 1;
      const row = rows.find((r) => r.id === secrets.get(body.p_secret));
      if (!row) return json(404, { message: 'no_profile' });
      if (!v3 && econ) return route.fulfill({ status: 204, body: '' });
      const now = Date.now();
      const d = decideSubmit(
        { level: row.level, rebirths: row.rebirths, lifetime_words: row.lifetime_words || 0, lifetime_letters: row.lifetime_letters || 0, submitted_at: row.submitted_at ?? null },
        { level: body.p_level, rebirths: body.p_rebirths, words: body.p_lifetime_words, letters: body.p_lifetime_letters },
        now,
      );
      calls.lastDecision = d.action;
      if (d.row) {
        Object.assign(row, d.row, { wins_per_word: Math.max(0, Math.round((Number(body.p_wins_per_word) || 0) * 10) / 10) });
        if (weekly) row.week_words = (row.week_words || 0) + d.weekDelta;
        if (v3) row.econ = 10;
        row.submitted = true;
      }
      return route.fulfill({ status: 204, body: '' });
    }
    if (caps && (v3 || url.pathname.endsWith('/rpc/lb_submit2'))) {
      calls.submit += 1;
      const row = rows.find((r) => r.id === secrets.get(body.p_secret));
      if (!row) return json(404, { message: 'no_profile' });
      if (v3) row.econ = 10;
      if (weekly) {
        const delta = row.submitted ? Math.max(0, body.p_lifetime_words - (row.lifetime_words || 0)) : 0;
        row.week_words = (row.week_words || 0) + delta;
        row.submitted = true;
      }
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
    if (weekly && url.pathname.endsWith('/rest/v1/leaderboard_weekly')) {
      const all = rows.filter((r) => (r.week_words || 0) > 0).slice()
        .sort((a, b) => b.week_words - a.week_words || b.level - a.level)
        .map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, level: r.level, rebirths: r.rebirths, week_words: r.week_words }));
      const id = url.searchParams.get('id');
      return json(200, id ? all.filter((r) => `eq.${r.id}` === id) : all.slice(0, Number(url.searchParams.get('limit') || 100)));
    }
    if (url.pathname.endsWith('/leaderboard')) {
      // PostgREST answers 400 for a column the view doesn't have (pre-017 `econ`)
      if (!boardEcon && /(^|,)econ(,|$)/.test(url.searchParams.get('select') || '')) {
        return json(400, { code: '42703', message: 'column leaderboard.econ does not exist' });
      }
      // LB10: the server-side rank count (HEAD + Prefer: count=exact with the view's order as an or=).
      const or = url.searchParams.get('or');
      if (or) {
        const n = (re) => Number((or.match(re) || [])[1]);
        const rb = n(/rebirths\.gt\.(\d+)/) || 0;
        const l = n(/level\.gt\.(\d+)/);
        const w = n(/lifetime_words\.gte\.(\d+)/);
        const ahead = ranked().filter((r) => {
          const rr = r.rebirths || 0;
          if (rr !== rb) return rr > rb;
          return r.level > l || (r.level === l && r.lifetime_words >= w);
        }).length;
        return route.fulfill({ status: 200, headers: { 'content-range': `*/${ahead}`, 'access-control-expose-headers': 'content-range' }, body: '' });
      }
      const id = url.searchParams.get('id');
      let all = ranked();
      // rival pings (src/leaderboard/client.js fetchRowAbove): `rank=lt.N&order=rank.desc`
      const lt = /^lt\.(\d+)$/.exec(url.searchParams.get('rank') || '');
      if (lt) all = all.filter((r) => r.rank < Number(lt[1]));
      if (url.searchParams.get('order') === 'rank.desc') all = all.slice().reverse();
      return json(200, id ? all.filter((r) => `eq.${r.id}` === id) : all.slice(0, Number(url.searchParams.get('limit') || 100)));
    }
    return json(404, { message: 'not mocked' });
  });
  return { rows, calls, secrets, saves, db };
}
