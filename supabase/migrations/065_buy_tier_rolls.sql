-- 065_buy_tier_rolls.sql - BUY AN EPIC+ / LEGENDARY+ ROLL (Andy oct24: "you just totally didnt do the epic+, legendary+
-- rolls"). The SHOP sells a sealed EPIC+ ROLL and a sealed LEGENDARY+ ROLL for gems. Each one is a 060 TICKET the SERVER
-- mints: the floor is the server's ticket row, it is opened through 060's lb_ticket_roll / lb_ticket_claim (the pick is
-- private.pick_ticket_gear - tiers at or above the floor, an unowned gear first, luck x1, no browser input), so nothing
-- about the guarantee can be faked from the browser.
--
--   public.lb_ticket_buy(secret, tier, request) -> { ok, ticket: { id, tier }, price, left } or { ok: false, reason }
--     * tier: 'epic' or 'legendary' ONLY (the two shop items). The PRICE and the hourly STOCK are SERVER constants
--       (private.ticket_shop below) - the browser sends no price, no luck, no floor beyond which item it is buying.
--     * GEMS: the gem wallet lives in the browser, so - exactly like a normal roll (036 lb_roll) - the price is added to
--       profiles.s2_roll_spent and refused once s2_roll_spent + price > private.gem_budget(pid) (the most this account
--       could ever have EARNED). A hand-edited wallet runs into the budget; the TESTER code skips it, as lb_roll does.
--     * STOCK: EPIC+ x2 and LEGENDARY+ x1 per wall-clock hour (UTC hour = the shop's RESTOCK window, v3/stock.js
--       windowOf), counted from the server's own ticket rows - a cleared localStorage never refills it.
--     * IDEMPOTENT: `request` (a uuid the browser makes once per buy and keeps until answered) is the ticket's grant key
--       ('shop:<request>'). A retried buy returns the SAME ticket and never charges twice.
--     * Pity is untouched (s2_since_epic / s2_since_leg / s2_rolls / s2_roll_seq do not move) - as every 060 ticket.
--   private.ticket_shop(tier) -> (price, per_hour). The ONE price table (mirrored by src/progress/rollTickets.js
--     TICKET_SHOP; guaranteedRolls.test.js pins the two together).
--
-- PRICES (claude/econ-oct2/tier-roll-price-sim.mjs, the shipped odds + pity, 10-gem rolls): an EPIC+ by rolling costs
-- ~90 gems at luck x1 (~50 at the x6.6 cap), a LEGENDARY+ ~465 (~175). The sealed roll skips the lottery, prefers a gear
-- you don't own and leaves your pity where it was, so it costs a premium: EPIC+ 150, LEGENDARY+ 750 (= ~1.6-1.7x rolling).
--
-- ORDER: after 060 (tickets) and 036 (gem_budget). RESET ACCOUNT already deletes every ticket (060 lb_reset_ack).
-- WRITE-ONLY: Claude never runs migrations. HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run.
-- Safe to re-run. ASCII only. Run THIS first, then merge the PR (until then the shop card reads SOON - lb_ticket_buy 404).

-- ---- the price table: the server's, never the browser's ---------------------------------------------------------------
create or replace function private.ticket_shop(p_tier text)
returns table (price integer, per_hour integer) language sql immutable set search_path = public, private, pg_temp as $$
  select v.price, v.per_hour from (values ('epic', 150, 2), ('legendary', 750, 1)) as v (tier, price, per_hour)
   where v.tier = p_tier;
$$;
revoke all on function private.ticket_shop(text) from public;
revoke all on function private.ticket_shop(text) from anon, authenticated;

create index if not exists roll_tickets_shop_idx on private.roll_tickets (profile_id, source, tier, granted_at);

-- ---- lb_ticket_buy: gems -> a sealed EPIC+ / LEGENDARY+ ticket ---------------------------------------------------------
create or replace function public.lb_ticket_buy(p_secret text, p_tier text, p_request uuid)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; sp record; t private.roll_tickets; k text; n integer; budget bigint; tk uuid;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p_request is null then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
  select * into sp from private.ticket_shop(p_tier);
  if not found then return json_build_object('ok', false, 'reason', 'bad_tier'); end if; -- only EPIC+ / LEGENDARY+ are sold
  select * into p from public.profiles where id = pid for update; -- one buy at a time per player (and vs lb_roll)
  k := 'shop:' || p_request::text;
  -- a RETRY of a buy that already went through: the SAME ticket, no second charge
  select * into t from private.roll_tickets where profile_id = pid and grant_key = k;
  if found then
    return json_build_object('ok', true, 'again', true, 'ticket', json_build_object('id', t.id, 'tier', t.tier, 'state', t.state),
                             'price', (select s.price from private.ticket_shop(t.tier) s));
  end if;
  -- the hourly STOCK (the shop's RESTOCK window = the UTC hour), from the server's own rows
  select count(*) into n from private.roll_tickets
   where profile_id = pid and source = 'shop' and tier = p_tier and granted_at >= date_trunc('hour', now());
  if n >= sp.per_hour then
    return json_build_object('ok', false, 'reason', 'sold_out', 'left', 0);
  end if;
  -- the GEM BUDGET (036): never spend more than this account could ever have earned
  budget := private.gem_budget(pid);
  if coalesce(p.s2_roll_spent, 0) + sp.price > budget and not coalesce(p.is_tester, false) then
    return json_build_object('ok', false, 'reason', 'budget', 'budget', budget, 'spent', p.s2_roll_spent);
  end if;
  tk := private.grant_ticket(pid, p_tier, 'shop', k, sp.price || ' gems');
  update public.profiles set s2_roll_spent = coalesce(s2_roll_spent, 0) + sp.price where id = pid;
  return json_build_object('ok', true, 'ticket', json_build_object('id', tk, 'tier', p_tier, 'state', 'owned'),
                           'price', sp.price, 'left', sp.per_hour - n - 1);
end $$;
revoke all on function public.lb_ticket_buy(text, text, uuid) from public;
grant execute on function public.lb_ticket_buy(text, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- ADMIN (SQL editor). SEE every bought roll (and what it opened into):
--   select p.username, t.tier, t.note, t.state, t.pick_tier, t.mark_id, t.shiny, t.granted_at, t.spent_at
--     from private.roll_tickets t join public.profiles p on p.id = t.profile_id where t.source = 'shop' order by t.granted_at desc;
