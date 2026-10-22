// guaranteedRolls.test.js — 060_guaranteed_rolls.sql and its client (Andy oct22 "make sure this system is flawless - no
// source code bs"). Pins the SQL's trust boundary (a ticket is minted only server-side, its floor is the server's row,
// it is spent once) and the client's (only a well-formed, server-listed ticket is ever drawn; a ticket roll never
// touches pity). The migration itself was also run end to end on a throwaway Postgres: claude/sql-sandbox/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROLL_MARKS, SHINY_CHANCE, freshState, tierRank } from '../progress/markRollsCore.js';
import { roll } from '../progress/markRolls.js';
import { normalizeTickets, bestTicket, spendPick, ticketTable, ticketTierOdds, countOf, ticketLabel } from '../progress/rollTickets.js';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const read = (f) => readFileSync(join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
const sql = read('060_guaranteed_rolls.sql');
const fn = (name) => {
  const at = sql.indexOf(`create or replace function ${name}(`);
  assert.ok(at >= 0, `060 defines ${name}`);
  return sql.slice(at, sql.indexOf('end $$;', at));
};
const ID = '0b6f5a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
const LEG = ROLL_MARKS.find((m) => m.tier === 'legendary');
const RARE = ROLL_MARKS.find((m) => m.tier === 'rare');

test('060: the only mint is private (no public grant door, anon cannot call it or touch the tables)', () => {
  assert.ok(!/create or replace function public\.[a-z_]*grant/i.test(sql), 'no public.*grant* function');
  assert.ok(sql.includes('revoke all on function private.grant_ticket(uuid, text, text, text, text) from anon, authenticated;'));
  for (const t of ['roll_tickets', 'streak_track']) {
    assert.ok(sql.includes(`revoke all on private.${t} from public;`));
    assert.ok(sql.includes(`revoke all on private.${t} from anon, authenticated;`));
  }
  assert.ok(sql.includes('revoke all on function private.pick_ticket_gear(uuid, text) from anon, authenticated;'));
  // the only callables: list / roll / claim / check-in (+ the reset that already existed)
  const pub = [...sql.matchAll(/grant execute on function public\.([a-z_0-9]+)\(/g)].map((m) => m[1]).sort();
  assert.deepEqual(pub, ['lb_reset_ack', 'lb_streak_checkin', 'lb_ticket_claim', 'lb_ticket_roll', 'lb_tickets']);
});

test('060: a grant pays once (unique key), and no ticket floor above MYTHIC+ exists', () => {
  assert.ok(sql.includes('unique (profile_id, grant_key)'));
  assert.ok(fn('private.grant_ticket').includes('on conflict (profile_id, grant_key) do nothing'));
  assert.ok(sql.includes("tier text not null check (tier in ('rare', 'epic', 'legendary', 'mythic'))"));
  assert.ok(fn('private.grant_ticket').includes("p_tier not in ('rare', 'epic', 'legendary', 'mythic') then raise exception 'bad_ticket'"));
});

test('060 ADVERSARIAL: the browser cannot pick the floor, pass luck, or spend another player\'s / a spent ticket', () => {
  const r = fn('public.lb_ticket_roll');
  assert.ok(r.startsWith('create or replace function public.lb_ticket_roll(p_secret text, p_ticket uuid)'), 'only the secret + the ticket id');
  assert.ok(!/p_tier|p_luck|p_floor/.test(r), 'no tier / luck / floor parameter');
  assert.ok(r.includes('private.pick_ticket_gear(pid, t.tier)'), 'the floor is the stored row\'s tier');
  assert.ok(r.includes('where id = p_ticket and profile_id = pid for update'), 'only the caller\'s own ticket');
  assert.ok(r.includes("if t.state = 'spent' then return json_build_object('ok', false, 'reason', 'spent'"), 'spent never re-rolls');
  assert.ok(r.includes("if t.state = 'reserved' then"), 'a reserved ticket hands back the SAME pick');
  assert.ok(r.includes(`SHINY constant double precision := ${SHINY_CHANCE};`));
  const pick = fn('private.pick_ticket_gear');
  assert.ok(pick.startsWith('create or replace function private.pick_ticket_gear(p_pid uuid, p_floor text)'), 'the pick takes no luck');
  assert.ok(pick.includes('where private.tier_rank(t.tier) >= fr'), 'only tiers at or above the floor');
  assert.ok(pick.includes('order by (exists (select 1 from private.gear_owned'), 'an unowned gear first');
  const c = fn('public.lb_ticket_claim');
  assert.ok(c.includes('where id = p_ticket and profile_id = pid for update'));
  assert.ok(c.includes("if t.state = 'spent' then return json_build_object('ok', true, 'again', true"), 'a retried claim is ok …');
  assert.ok(c.indexOf("if t.state = 'spent'") < c.indexOf('insert into private.gear_owned'), '… and adds no second copy');
  assert.ok(c.includes("if t.state <> 'reserved' then return json_build_object('ok', false, 'reason', 'not_reserved')"));
});

test('060: a ticket roll leaves pity, the roll seq and the gem spend alone', () => {
  for (const f of ['public.lb_ticket_roll', 'public.lb_ticket_claim']) {
    const b = fn(f);
    assert.ok(!/s2_since_epic|s2_since_leg|s2_rolls|s2_roll_seq|s2_roll_spent|roll_log/.test(b), `${f} touches no pity / seq / spend`);
  }
  assert.ok(!sql.includes('create or replace function public.lb_roll('), '060 does not redefine lb_roll');
  assert.ok(!sql.includes('create or replace function public.lb_roll_claim('), '060 does not redefine lb_roll_claim');
});

test('060: the streak check-in is server-checked (day window, one step a day, real play, missed-day rule, real time)', () => {
  const s = fn('public.lb_streak_checkin');
  assert.ok(s.includes('if p_day is null or p_day < utc_day - 1 or p_day > utc_day + 1 then'));
  assert.ok(s.includes('if p_day <= st.last_day then'), 'no replays / no second step a day');
  assert.ok(s.includes("if coalesce(p.lifetime_words, 0) <= st.last_words or p.submitted_at is null or p.submitted_at < now() - interval '1 day' then"));
  assert.ok(s.includes('if gap >= 3 then pos0 := 0; week0 := 1; end if;'), 'calendar.js settle: 3+ resets');
  assert.ok(s.includes('now() < run0 + make_interval(days => d - 2)'), 'DAY 7 never under 5 real days');
  assert.ok(s.includes("if d = 4 then tk_tier := 'rare'; elsif d = 7 then tk_tier := 'legendary'; end if;"));
  assert.ok(s.includes("'streak:' || p_day || ':d' || d"), 'grant key = the (only-rising) day index');
});

test('060: lb_reset_ack keeps every 058 wipe and adds the tickets + the streak track', () => {
  const s58 = read('058_reset_wipes_everything.sql');
  const wipes = s58.match(/delete from [a-z_.]+ where profile_id = pid;/g);
  const body = fn('public.lb_reset_ack');
  for (const w of wipes) assert.ok(body.includes(w), `060 keeps: ${w}`);
  assert.ok(body.includes('delete from private.roll_tickets where profile_id = pid;'));
  assert.ok(body.includes('delete from private.streak_track where profile_id = pid;'));
  assert.ok(body.includes('length(p_blob) > 1048576'), '056\'s 1 MB cap kept');
  const last = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().filter((f) => read(f).includes('create or replace function public.lb_reset_ack(')).pop();
  assert.equal(last, '060_guaranteed_rolls.sql', 'the latest lb_reset_ack is 060');
});

test('060 is ASCII-only and write-only', () => {
  assert.ok([...sql].every((ch) => ch.charCodeAt(0) < 128), 'ASCII only');
  assert.ok(sql.includes('WRITE-ONLY: Claude never runs migrations'));
});

test('client: only well-formed server rows are drawn — forged tiers, ids, picks below the floor are dropped', () => {
  assert.deepEqual(normalizeTickets(null), []);
  assert.deepEqual(normalizeTickets({ ok: false, tickets: [{ id: ID, tier: 'legendary', state: 'owned' }] }), []);
  const rows = normalizeTickets({ ok: true, tickets: [
    { id: ID, tier: 'legendary', state: 'owned', source: 'streak' },
    { id: ID, tier: 'secret', state: 'owned' }, // no SECRET+ tickets exist
    { id: 'not-a-uuid', tier: 'mythic', state: 'owned' },
    { id: ID, tier: 'legendary', state: 'spent' }, // spent never shows
    { id: ID, tier: 'legendary', state: 'reserved', pick: { mark: RARE.id, tier: 'rare' } }, // below its floor
    { id: ID, tier: 'epic', state: 'reserved', pick: { mark: 'mk-made-up', tier: 'secret' } }, // not a gear
    { id: ID, tier: 'rare', state: 'reserved', pick: { mark: LEG.id, tier: 'rare', shiny: 'yes' } }, // tier comes from the pool
  ] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tier, 'legendary');
  assert.deepEqual(rows[1].pick, { mark: LEG.id, tier: 'legendary', shiny: false });
  assert.equal(bestTicket(rows), rows[1], 'a reserved ticket finishes first');
  assert.equal(countOf(rows, 'legendary'), 1);
  assert.equal(ticketLabel('legendary'), 'LEGENDARY+');
});

test('client: a spend reply below the ticket\'s floor lands nothing', () => {
  assert.equal(spendPick({ ok: true, pick: { mark: RARE.id, shiny: false } }, 'legendary'), null);
  assert.equal(spendPick({ ok: false, reason: 'spent' }, 'legendary'), null);
  assert.deepEqual(spendPick({ ok: true, pick: { mark: LEG.id, shiny: true } }, 'legendary'), { mark: LEG.id, tier: 'legendary', shiny: true });
});

test('client: ticketTable = the SQL pick odds (game tier odds at luck x1, floor and up, sums to 1)', () => {
  for (const floor of ['rare', 'epic', 'legendary', 'mythic']) {
    const probs = ticketTable(floor);
    let tot = 0;
    for (const m of ROLL_MARKS) {
      const p = probs.get(m.id);
      tot += p;
      if (tierRank(m.tier) < tierRank(floor)) assert.equal(p, 0, `${m.id} is under the ${floor} floor`);
    }
    assert.ok(Math.abs(tot - 1) < 1e-9);
  }
  const leg = ticketTierOdds('legendary');
  assert.ok(Math.abs(leg.legendary - 0.01 / (0.01 + 0.0005 + 1 / 15000)) < 1e-9, 'LEGENDARY ~94.7%');
  assert.ok(leg.legendary > 0.94 && leg.legendary < 0.95);
});

test('client: a ticket roll lands the pick and leaves the roll count + pity alone', () => {
  const s0 = { ...freshState(), rolls: 37, sinceEpic: 8, sinceLegendary: 44 };
  const out = roll(() => 0.5, s0, { pickId: LEG.id, shiny: false, ticket: 'legendary' });
  assert.equal(out.result.markId, LEG.id);
  assert.equal(out.result.ticket, 'legendary');
  assert.equal(out.state.rolls, 37);
  assert.equal(out.state.sinceEpic, 8);
  assert.equal(out.state.sinceLegendary, 44);
  assert.equal(out.result.pityHit, null);
  const normal = roll(() => 0.5, s0, { pickId: LEG.id, shiny: false });
  assert.equal(normal.state.rolls, 38);
  assert.equal(normal.state.sinceLegendary, 0);
});
