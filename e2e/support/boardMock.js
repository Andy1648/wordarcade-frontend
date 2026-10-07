// e2e/support/boardMock.js — the leaderboard's REST API, mocked (the e2e build points
// VITE_SUPABASE_URL at lb.e2e.invalid — see playwright.config.js). A tiny in-memory board that applies
// the DB's name rules via the CLIENT filter (DB/client parity is pinned by claude/step24/db-parity.mjs).
// Ranking matches the view (017, Andy oct3 19:55): rebirths, level, lifetime words, then first-come (stable sort).
import { isNameBlocked } from '../../src/leaderboard/nameFilter.js';
import { decideSubmit } from '../../src/leaderboard/submitRules.js';
import { decideRebirth, decideAscend } from '../../src/leaderboard/rebirthRules.js';
import { decideSubmitFinal } from '../../src/leaderboard/finalRules.js'; // 027: FINAL v2's season-2 write
import { decideSeason2Claim, peekSeason2Grant } from '../../src/leaderboard/season2Rules.js';
import { s2WeekGains, compareWeekS2 } from '../../src/leaderboard/s2Board.js';

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
// `rebirth` emulates 021_server_rebirth.sql: lb_caps.rebirth_rpc + lb_rebirth running the REAL server rule
// (src/leaderboard/rebirthRules.js decideRebirth — stored-row gate, request-id log, rate, pace) on the Node clock.
// `{ delayMs }` holds each answer that long (to see the pending button). Off → lb_rebirth answers PGRST202 (not run).
// `season2` emulates 022_season2_board.sql (PROGRESSION v3): lb_caps.season2 + econ2 13, lb_submit3 with p_econ 13 runs
// the REAL season-2 write (submitRules.decideSubmitS2), lb_rebirth / lb_ascend see the row's econ (the econ-13 guard),
// and public.leaderboard_s2 ranks ★ → rebirths → level.
// `season2Reset` emulates 023_season2_reset.sql (THE RESET): lb_caps.season2_reset + lb_season2_grant / lb_season2_claim
// running the REAL rule (season2Rules.js) on db.grants (profile id → { gems, rebirths, claimed_at, claim_request }).
// `s2Weekly` emulates 024_season2_weekly.sql: public.leaderboard_s2_weekly — season-2 rows ranked by ★ / rebirths /
// levels GAINED this week (a row's week_* fields, or s2Board.s2WeekGains over its s2_week_* baseline). Off → that view
// 404s like an unrun migration (the client then reads leaderboard_weekly filtered to econ 13).
export async function mockBoard(page, seed = [], { caps = false, shared = null, weekly = false, selfReset = true, rules = false, econ = false, boardEcon = false, rebirth = null, season2 = false, season2Reset = false, s2Weekly = false } = {}) {
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
        ? json(200, { letters: true, cjk: true, cloud: true, ...(weekly ? { weekly: true } : {}), ...(econ ? { econ: 10 } : {}), ...(boardEcon ? { board_econ: true } : {}), ...(rebirth ? { rebirth_rpc: true } : {}), ...(season2 ? { season2: true, econ2: 13 } : {}), ...(season2Reset ? { season2_reset: true } : {}) })
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
    // 021: the server-checked rebirth (one per call, idempotent by request id) — the real rule from rebirthRules.js
    if (caps && url.pathname.endsWith('/rpc/lb_rebirth')) {
      if (!rebirth) return json(404, { code: 'PGRST202', message: 'Could not find the function public.lb_rebirth' });
      const pid = secrets.get(body.p_secret);
      const row = rows.find((r) => r.id === pid);
      if (!row) return json(400, { message: 'no_profile' });
      calls.rebirth = (calls.rebirth || 0) + 1;
      calls.rebirthIds = [...(calls.rebirthIds || []), body.p_request_id];
      const delay = (rebirth && rebirth.delayMs) || 0;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (!db.rebirthLogs) db.rebirthLogs = new Map();
      const log = db.rebirthLogs.get(pid) || [];
      const out = decideRebirth({ level: row.level, rebirths: row.rebirths || 0, stars: row.stars || 0, ...(season2 ? { econ: row.econ || 0 } : {}) }, { requestId: body.p_request_id, season: body.p_season }, log, Date.now());
      row.level = out.row.level;
      row.rebirths = out.row.rebirths;
      if (out.entry) log.push(out.entry);
      db.rebirthLogs.set(pid, log);
      return json(200, out.result);
    }
    // 022: lb_ascend (season 2, econ-13 row) — the real rule
    if (caps && url.pathname.endsWith('/rpc/lb_ascend')) {
      if (!rebirth || !season2) return json(404, { code: 'PGRST202', message: 'Could not find the function public.lb_ascend' });
      const pid = secrets.get(body.p_secret);
      const row = rows.find((r) => r.id === pid);
      if (!row) return json(400, { message: 'no_profile' });
      calls.ascend = (calls.ascend || 0) + 1;
      if (!db.rebirthLogs) db.rebirthLogs = new Map();
      const log = db.rebirthLogs.get(pid) || [];
      const out = decideAscend({ level: row.level, rebirths: row.rebirths || 0, stars: row.stars || 0, econ: row.econ || 0 }, { requestId: body.p_request_id, season: body.p_season }, log, Date.now());
      Object.assign(row, { level: out.row.level, rebirths: out.row.rebirths, stars: out.row.stars || 0 });
      if (out.entry) log.push(out.entry);
      db.rebirthLogs.set(pid, log);
      return json(200, out.result);
    }
    // 023: the season-2 gift — peek + the one-shot claim (the real rule)
    if (caps && (url.pathname.endsWith('/rpc/lb_season2_grant') || url.pathname.endsWith('/rpc/lb_season2_claim'))) {
      if (!season2Reset) return json(404, { code: 'PGRST202', message: 'Could not find the function' });
      const pid = secrets.get(body.p_secret);
      if (!pid) return json(400, { message: 'no_profile' });
      if (!db.grants) db.grants = new Map();
      if (url.pathname.endsWith('/rpc/lb_season2_grant')) return json(200, peekSeason2Grant(db.grants.get(pid) || null));
      calls.season2Claim = (calls.season2Claim || 0) + 1;
      const out = decideSeason2Claim(db.grants.get(pid) || null, body.p_request_id);
      if (out.grant) db.grants.set(pid, out.grant);
      return json(200, out.result);
    }
    // 022/027: the season-2 board write (p_econ 13) — the real rule (finalRules.decideSubmitFinal, 027)
    if (caps && season2 && url.pathname.endsWith('/rpc/lb_submit3') && body.p_econ === 13) {
      calls.submit += 1;
      calls.submitS2 = (calls.submitS2 || 0) + 1;
      const row = rows.find((r) => r.id === secrets.get(body.p_secret));
      if (!row) return json(404, { message: 'no_profile' });
      const d = decideSubmitFinal( // 027 supersedes 022's write (decideSubmitS2 kept for its own tests)
        { level: row.level, rebirths: row.rebirths || 0, lifetime_words: row.lifetime_words || 0, lifetime_letters: row.lifetime_letters || 0, submitted_at: row.submitted_at ?? null, econ: row.econ || 0 },
        { level: body.p_level, rebirths: body.p_rebirths, words: body.p_lifetime_words, letters: body.p_lifetime_letters },
        Date.now(),
      );
      calls.lastDecision = d.action;
      if (d.row) Object.assign(row, d.row, { wins_per_word: Math.max(0, Math.round((Number(body.p_wins_per_word) || 0) * 10) / 10) });
      return route.fulfill({ status: 204, body: '' });
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
    if (season2 && s2Weekly && url.pathname.endsWith('/rest/v1/leaderboard_s2_weekly')) {
      calls.s2Weekly = (calls.s2Weekly || 0) + 1;
      const all = rows.filter((r) => r.econ === 13)
        .map((r) => ({ ...r, stars: r.stars || 0, ...(r.week_stars != null || r.week_rebirths != null || r.week_levels != null ? {} : s2WeekGains(r)) }))
        .filter((r) => (r.week_stars || 0) > 0 || (r.week_rebirths || 0) > 0 || (r.week_levels || 0) > 0 || (r.week_words || 0) > 0)
        .sort(compareWeekS2)
        .map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, level: r.level, rebirths: r.rebirths, stars: r.stars, week_stars: r.week_stars || 0, week_rebirths: r.week_rebirths || 0, week_levels: r.week_levels || 0, week_words: r.week_words || 0 }));
      const id = url.searchParams.get('id');
      return json(200, id ? all.filter((r) => `eq.${r.id}` === id) : all.slice(0, Number(url.searchParams.get('limit') || 100)));
    }
    if (weekly && url.pathname.endsWith('/rest/v1/leaderboard_weekly')) {
      // 021's view carries econ: `econ=eq.13` (the season-2 client's fallback before 024) keeps season-2 rows only
      const econEq = /^eq\.(\d+)$/.exec(url.searchParams.get('econ') || '');
      const all = rows.filter((r) => (r.week_words || 0) > 0 && (!econEq || r.econ === Number(econEq[1]))).slice()
        .sort((a, b) => b.week_words - a.week_words || b.level - a.level)
        .map((r, i) => ({ rank: i + 1, id: r.id, username: r.username, level: r.level, rebirths: r.rebirths, week_words: r.week_words }));
      const id = url.searchParams.get('id');
      return json(200, id ? all.filter((r) => `eq.${r.id}` === id) : all.slice(0, Number(url.searchParams.get('limit') || 100)));
    }
    if (season2 && url.pathname.endsWith('/leaderboard_s2')) {
      // 022: season-2 rows (econ 13) only, ★ → rebirths → level → words
      const all = rows.filter((r) => r.econ === 13).slice()
        .sort((a, b) => (b.stars || 0) - (a.stars || 0) || (b.rebirths || 0) - (a.rebirths || 0) || b.level - a.level || b.lifetime_words - a.lifetime_words)
        .map((r, i) => { const o = { ...r, rank: i + 1, stars: r.stars || 0 }; delete o.submitted_at; return o; });
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
