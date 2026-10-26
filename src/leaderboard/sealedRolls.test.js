// sealedRolls.test.js — 065_buy_tier_rolls.sql (the SHOP's SEALED EPIC+ / LEGENDARY+ ROLLS) and its client. Pins the trust
// boundary: the SERVER owns the price, the stock, the floor and the gem budget; the browser sends only the tier + a
// request id; a retried buy never pays twice; the client price table mirrors the server's. The migration itself was run
// end to end on a throwaway Postgres (PGlite): claude/sql-sandbox/065-buy-tier-rolls.mjs (36 checks).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TICKET_SHOP, buyOutcome } from '../progress/rollTickets.js';

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '065_buy_tier_rolls.sql'), 'utf8').replace(/\r\n/g, '\n');
const fn = (name) => {
  const at = sql.indexOf(`create or replace function ${name}(`);
  assert.ok(at >= 0, `065 defines ${name}`);
  return sql.slice(at, sql.indexOf('$$;', sql.indexOf('$$', at) + 2));
};
const ID = '0b6f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';

test('065: ASCII only, and the only new public door is lb_ticket_buy', () => {
  assert.ok([...sql].every((ch) => ch.charCodeAt(0) < 128),'ASCII only (the SQL editor paste)');
  const pub = [...sql.matchAll(/grant execute on function public\.([a-z_0-9]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(pub, ['lb_ticket_buy']);
  assert.ok(sql.includes('revoke all on function private.ticket_shop(text) from anon, authenticated;'));
  assert.ok(!/create or replace function public\.[a-z_]*grant/i.test(sql), 'no public grant door');
});

test('065: the original price table (superseded by 069) sold EPIC+ 150 / LEGENDARY+ 750', () => {
  const shop = fn('private.ticket_shop');
  const rows = Object.fromEntries([...shop.matchAll(/\('([a-z]+)', (\d+), (\d+)\)/g)].map((m) => [m[1], { price: Number(m[2]), perHour: Number(m[3]) }]));
  assert.deepEqual(rows, { epic: { price: 150, perHour: 2 }, legendary: { price: 750, perHour: 1 } });
});

// ---- 069_shop_epic_only.sql (Andy oct26): EPIC+ only, 500 gems -------------------------------------------------------
const sql69 = readFileSync(join(process.cwd(), 'supabase', 'migrations', '069_shop_epic_only.sql'), 'utf8').replace(/\r\n/g, '\n');
const fn69 = (name) => {
  const at = sql69.indexOf(`create or replace function ${name}(`);
  assert.ok(at >= 0, `069 defines ${name}`);
  return sql69.slice(at, sql69.indexOf('$$;', sql69.indexOf('$$', at) + 2));
};

test('069: the price + stock are the SERVER\'s (EPIC+ 500 x2, no LEGENDARY+), and the client mirror matches exactly', () => {
  const shop = fn69('private.ticket_shop');
  const rows = Object.fromEntries([...shop.matchAll(/\('([a-z]+)', (\d+), (\d+)\)/g)].map((m) => [m[1], { price: Number(m[2]), perHour: Number(m[3]) }]));
  assert.deepEqual(rows, { epic: { price: 500, perHour: 2 } });
  assert.deepEqual(JSON.parse(JSON.stringify(TICKET_SHOP)), rows);
});

test('069: ASCII, re-runnable, recreates only ticket_shop + lb_ticket_buy; LEGENDARY+ -> not_sold; a paid retry still answers', () => {
  assert.ok([...sql69].every((ch) => ch.charCodeAt(0) < 128), 'ASCII only (the SQL editor paste)');
  const made = [...sql69.matchAll(/create or replace function ([a-z_.]+)\(/g)].map((m) => m[1]);
  assert.deepEqual(made, ['private.ticket_shop', 'public.lb_ticket_buy']);
  assert.ok(!/^\s*(drop|delete|insert|alter)\b/im.test(sql69), 'nothing destructive');
  assert.ok(!/lb_wheel|daily_wheel|grant_ticket\(pid, 'legendary'/.test(sql69), 'the wheel jackpot / grants are untouched');
  const b = fn69('public.lb_ticket_buy');
  assert.ok(b.includes("if not found then return json_build_object('ok', false, 'reason', 'not_sold')"));
  assert.ok(b.indexOf("'again', true") < b.indexOf("'not_sold'"), 'a pre-069 paid buy (its request id) is answered BEFORE the not-sold check');
  assert.ok(b.indexOf("'again', true") < b.indexOf('s2_roll_spent = coalesce(s2_roll_spent, 0) + sp.price'), 'a retry never charges');
  for (const keep of ['budget := private.gem_budget(pid);', "'reason', 'sold_out'", 'for update', "private.grant_ticket(pid, p_tier, 'shop', k,"]) assert.ok(b.includes(keep), keep);
  assert.ok(!/p_price|p_luck|p_floor|p_gems/.test(b), 'no price / luck / floor parameter');
  assert.ok(sql69.includes('grant execute on function public.lb_ticket_buy(text, text, uuid) to anon, authenticated;'));
  assert.ok(sql69.includes('revoke all on function private.ticket_shop(text) from anon, authenticated;'));
});

test('065 ADVERSARIAL: the browser sends no price / floor / luck; the floor is the ticket row; a buy pays once', () => {
  const b = fn('public.lb_ticket_buy');
  assert.ok(b.startsWith('create or replace function public.lb_ticket_buy(p_secret text, p_tier text, p_request uuid)'));
  assert.ok(!/p_price|p_luck|p_floor|p_gems/.test(b), 'no price / luck / floor parameter');
  assert.ok(b.includes("if not found then return json_build_object('ok', false, 'reason', 'bad_tier')"), 'only the two sold tiers');
  assert.ok(b.includes("k := 'shop:' || p_request::text;"), 'the request id is the grant key');
  assert.ok(b.includes("'again', true"), 'a retry returns the SAME ticket');
  // the retry check comes BEFORE any charge
  assert.ok(b.indexOf("'again', true") < b.indexOf('s2_roll_spent = coalesce(s2_roll_spent, 0) + sp.price'));
  assert.ok(b.includes('private.grant_ticket(pid, p_tier, \'shop\', k,'), 'minted through 060\'s one mint, floor = the sold tier');
  assert.ok(b.includes('for update'), 'one buy at a time per player');
});

test('065: the gem budget (036) caps the spend like a normal roll; the stock is counted from server rows', () => {
  const b = fn('public.lb_ticket_buy');
  assert.ok(b.includes('budget := private.gem_budget(pid);'));
  assert.ok(b.includes("if coalesce(p.s2_roll_spent, 0) + sp.price > budget and not coalesce(p.is_tester, false) then"));
  assert.ok(b.includes("source = 'shop' and tier = p_tier and granted_at >= date_trunc('hour', now())"));
  assert.ok(b.includes("'reason', 'sold_out'"));
  assert.ok(!/s2_since_epic|s2_since_leg|s2_rolls|s2_roll_seq/.test(b), 'pity is never touched');
});

test('buyOutcome: only a well-formed ok is trusted; a definite no refunds; anything else retries (never re-pays)', () => {
  assert.deepEqual(buyOutcome({ ok: true, ticket: { id: ID, tier: 'legendary' }, left: 0 }).kind, 'ok');
  assert.equal(buyOutcome({ ok: true, ticket: { id: ID, tier: 'legendary' }, left: 0 }).ticket.tier, 'legendary');
  assert.equal(buyOutcome({ ok: true, ticket: { id: 'nope', tier: 'legendary' } }).kind, 'retry');
  assert.equal(buyOutcome({ ok: true, ticket: { id: ID, tier: 'mythic' } }).kind, 'retry', 'the shop sells no MYTHIC+');
  assert.equal(buyOutcome({ ok: true, ticket: { id: ID, tier: 'epic' }, price: 150 }).kind, 'ok', 'a pre-069 server price is tolerated');
  assert.deepEqual(buyOutcome({ ok: false, reason: 'not_sold' }), { kind: 'refund', reason: 'not_sold' });
  assert.deepEqual(buyOutcome({ ok: false, reason: 'budget' }), { kind: 'refund', reason: 'budget' });
  assert.deepEqual(buyOutcome({ ok: false, reason: 'sold_out' }), { kind: 'refund', reason: 'sold_out' });
  assert.equal(buyOutcome(null).kind, 'retry');
  assert.equal(buyOutcome({}).kind, 'retry');
});
