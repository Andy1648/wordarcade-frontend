// rename cooldown + submit throttle/shape, using one secret (claim limit is hit, so reuse a created row's secret by inserting directly)
const { Client } = require('pg');
const B = process.env.SUPA_URL, K = process.env.SUPA_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const rpc = async (fn, body) => { const r = await fetch(`${B}/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return `${r.status} ${(j && j.message) || ''}`; };
(async () => {
  const c = new Client({ host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: 'postgres.oajvvwptwifspmwiohlt', password: process.env.PG_PASS, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  const secret = 'zqp' + 'c'.repeat(45);
  const { rows } = await c.query(`insert into public.profiles (username) values ('zqpHonest1') returning id`);
  const id = rows[0].id;
  await c.query(`insert into private.profile_secrets (profile_id, secret_hash) values ($1, extensions.digest($2, 'sha256'))`, [id, secret]);
  const o = {};
  o.first = await rpc('lb_submit', { p_secret: secret, p_level: 16, p_rebirths: 0, p_lifetime_words: 56, p_wins_per_word: 1 });
  await c.query(`update public.profiles set submitted_at = now() - interval '6 seconds' where id = $1`, [id]);
  o.honestUp = await rpc('lb_submit', { p_secret: secret, p_level: 17, p_rebirths: 0, p_lifetime_words: 80, p_wins_per_word: 2 });
  o.afterHonestUp = (await c.query(`select level, lifetime_words from public.profiles where id = $1`, [id])).rows[0];
  await c.query(`update public.profiles set submitted_at = now() - interval '6 seconds' where id = $1`, [id]);
  o.rebirthReset = await rpc('lb_submit', { p_secret: secret, p_level: 1, p_rebirths: 1, p_lifetime_words: 90, p_wins_per_word: 3 });
  o.afterRebirth = (await c.query(`select level, rebirths, lifetime_words from public.profiles where id = $1`, [id])).rows[0];
  console.log(JSON.stringify(o, null, 1));
  // cleanup: every probe row + its log rows
  const del = await c.query(`delete from public.profiles where username like 'zqp%' returning username`);
  await c.query(`delete from private.claim_log`);
  console.log('deleted', del.rowCount, 'left', (await c.query('select count(*) n from public.profiles')).rows[0].n);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
