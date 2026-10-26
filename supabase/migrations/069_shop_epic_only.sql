-- 069_shop_epic_only.sql - THE SHOP SELLS EPIC+ ONLY, AT 500 GEMS (Andy oct26: "why does legendary cost 750 gems - it's
-- like 10x better than rolling (people won't roll then)... don't include in shop (i dont mind epic+ - which should be
-- like 500 gems)").
--
-- FORWARD CHANGE on 065 (065_buy_tier_rolls.sql):
--   * private.ticket_shop: EPIC+ 150 -> 500 gems (hourly stock unchanged, 2); LEGENDARY+ is no longer a row, so it has
--     no price and no stock.
--   * public.lb_ticket_buy: 'legendary' (or any tier not in the price table) -> { ok: false, reason: 'not_sold' }.
--     A RETRY of a LEGENDARY+ buy that already went through BEFORE this ran still returns its ticket (the request-id
--     lookup runs first) - a paid buy is never stranded.
--   * UNTOUCHED: LEGENDARY+ tickets from the daily wheel jackpot (067), streak / admin grants (060), lb_tickets /
--     lb_ticket_roll / lb_ticket_claim, the gem budget, the hourly window, the idempotent request key.
--
-- PRICE (claude/econ-oct2/tier-roll-price-sim.mjs, shipped odds + pity, 10-gem rolls): an EPIC+ by plain rolling costs
-- ~87-90 gems at luck x1 (~50 at the x6.6 cap). 500 = ~5.6x rolling at x1 (~10x at the cap), and an EPIC+ ticket opens
-- LEGENDARY+ only ~33% of the time (ticketTierOdds('epic')) - ~1,500 gems per LEGENDARY+ that way vs ~465 by rolling.
-- Rolling stays the efficient path; the sealed roll is the "skip the lottery, new gear first" premium.
--
-- ORDER: after 065. Safe to re-run (create or replace only). ASCII only.
-- WRITE-ONLY: Claude never runs migrations. HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run.
-- The client already shows EPIC+ at 500 and no LEGENDARY+ card; until this runs the server still books 150 against the
-- gem budget for an EPIC+ (harmless: the browser wallet pays 500 either way).

-- ---- the price table: EPIC+ only -------------------------------------------------------------------------------------
create or replace function private.ticket_shop(p_tier text)
returns table (price integer, per_hour integer) language sql immutable set search_path = public, private, pg_temp as $$
  select v.price, v.per_hour from (values ('epic', 500, 2)) as v (tier, price, per_hour)
   where v.tier = p_tier;
$$;
revoke all on function private.ticket_shop(text) from public;
revoke all on function private.ticket_shop(text) from anon, authenticated;

-- ---- lb_ticket_buy: a retry is answered first; anything the shop does not sell -> not_sold -----------------------------
create or replace function public.lb_ticket_buy(p_secret text, p_tier text, p_request uuid)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; p public.profiles; sp record; t private.roll_tickets; k text; n integer; budget bigint; tk uuid;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p_request is null then return json_build_object('ok', false, 'reason', 'bad_request'); end if;
  select * into p from public.profiles where id = pid for update; -- one buy at a time per player (and vs lb_roll)
  k := 'shop:' || p_request::text;
  -- a RETRY of a buy that already went through (a pre-069 LEGENDARY+ one too): the SAME ticket, no second charge
  select * into t from private.roll_tickets where profile_id = pid and grant_key = k;
  if found then
    return json_build_object('ok', true, 'again', true, 'ticket', json_build_object('id', t.id, 'tier', t.tier, 'state', t.state),
                             'price', (select s.price from private.ticket_shop(t.tier) s));
  end if;
  select * into sp from private.ticket_shop(p_tier);
  if not found then return json_build_object('ok', false, 'reason', 'not_sold'); end if; -- only EPIC+ is sold (069)
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

-- CHECK (SQL editor, after running): select * from private.ticket_shop('epic');      -> 500 | 2
--                                    select * from private.ticket_shop('legendary'); -> (no rows)
