-- 089_paid_packs.sql - PAID PACKS (Andy nov9: "make a 'packs' in the shop that offer mythic/secret packs for real money").
--
-- A MYTHIC PACK ($4.99) or SECRET PACK ($14.99) is ONE GEAR ROLL WITH A GUARANTEED FLOOR, bought through the same Stripe
-- Checkout as gems (082): same price table (src/payments/packs.js ROLL_PACKS), same $20 monthly cap (pay_reserve counts
-- every purchase's cents, packs included), same SIGN IN WITH GOOGLE requirement (085/086), same flag.
--
-- WHAT THE WEBHOOK GRANTS: a SERVER TICKET - 060's guaranteed-roll row in private.roll_tickets (source 'pay', grant key
-- 'pay:<checkout session id>'), never gems and never a roll the browser makes. It opens through 060's lb_ticket_roll /
-- lb_ticket_claim: the floor is the ticket ROW's tier, the tier is drawn at the game's own odds (luck x1) at or above the
-- floor, and inside the tier a gear the player does not own yet comes first (private.pick_ticket_gear). Pity untouched.
--
--   * private.roll_tickets.tier / grant_ticket / pick_ticket_gear now also take 'secret' (a SECRET floor can only land
--     SECRET). Every other ticket source (streak, wheel, shop, admin) is unchanged.
--   * pay_purchases gets kind ('gems' | 'pack'), ticket_tier and ticket_id. Rows from before this file are 'gems'.
--   * pay_grant_pack(...)  service role only. ONCE PER CHECKOUT SESSION, the same idempotency as gems: the purchase row's
--     primary key is the session id (a redelivered webhook is a 'duplicate' and mints nothing) and the ticket's grant key
--     is the session id too (unique per player). pay_purchases.gems holds the pack's GEM VALUE (packs.js debtGems: the
--     same dollars at the best gem rate, 800/$) - it is NOT granted; it is what a refund claws if the pack was opened.
--     No ledger row is written on a pack grant, so pay_gems_pending never hands out gems for a pack.
--   * FIRST BUY x2 (088) is GEMS ONLY: a pack never doubles (pay_grant_pack has no bonus), and buying a pack does not use
--     up the gem bonus (private.first_buy_open now counts gem purchases only).
--
-- REFUND / DISPUTE (pay_claw2, the webhook's one claw door - redefined here with the pack branch first):
--   * UNOPENED pack (ticket state 'owned'): the ticket is REVOKED (lb_ticket_roll / lb_tickets never show it again).
--     Any refund > 0 revokes it whole (a ticket can't be split). Nothing is taken off the wallet.
--   * OPENED pack (ticket 'reserved' - its pick may already be in the save - or 'spent', or gone with a RESET ACCOUNT):
--     handled EXACTLY like spent gems (082 CLAWBACK): 082's pay_claw writes a negative ledger row of the pack's gem value
--     (pro rata for a partial refund, all of it for a dispute; cumulative, never twice). The browser takes those gems off
--     its balance, floored at 0, and the server keeps the rest as a DEBT on the gem budget: gem_budget below now adds the
--     NET paid ledger unfloored, so server rolls / sealed tickets stay refused until the player has earned it back. (For
--     gem purchases the net is never negative, so their budget is unchanged.)
--   * A dispute flags the profile AND the Google account (086), opened or not.
--   * Retries are no-ops: a revoked ticket stays revoked, a claw only takes what is newly owed.
--
-- PRICES (the sim is in the PR: 4M simulated rolls on the server's pick_gear - luck, x2 bonus every 10th, EPIC 10 / LEG 60
-- pity, 75-gem rolls): a MYTHIC-or-better by rolling costs ~50,000 gems at luck x1 and ~17,700 at a fresh account's x6.6
-- luck cap; a SECRET ~439,000 / ~149,000. At the gem packs' 503-800 gems/$ that is $22-100 for a MYTHIC+ and $187-870 for a
-- SECRET, so $4.99 / $14.99 are clearly better value, while the shared $20 cap holds a month to 4 MYTHIC packs or 1 SECRET
-- + 1 MYTHIC.
-- ODDS (exact, shown one tap away on each card; src/payments/packOdds.js computes them from the same table):
--   MYTHIC PACK: MYTHIC 88.24% (15/17) - one of 14, a gear you don't own first; SECRET 11.76% (2/17) - one of 3. SHINY 1.5%.
--   SECRET PACK: SECRET 100% - one of 3 (ORIGIN / PARADOX / MEGATON), one you don't own first. SHINY 1.5%.
--
-- ORDER: after 082, 085, 086, 088 and 060 (and 036 for gem_budget). WRITE-ONLY: Claude never runs migrations. Run once in
-- the Supabase SQL editor (the whole file). Safe to re-run (if not exists / create or replace / the same grants). ASCII only.
-- Run it BEFORE switching the packs on: until then a pack checkout's webhook 500s (pay_grant_pack missing) and Stripe
-- retries it for 3 days, so a purchase made early still lands once this has run.

-- ---- tickets: a SECRET floor -------------------------------------------------------------------------------------------
alter table private.roll_tickets drop constraint if exists roll_tickets_tier_check;
alter table private.roll_tickets add constraint roll_tickets_tier_check check (tier in ('rare', 'epic', 'legendary', 'mythic', 'secret'));

create or replace function private.grant_ticket(p_pid uuid, p_tier text, p_source text, p_key text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v uuid;
begin
  if p_pid is null or p_tier is null or p_tier not in ('rare', 'epic', 'legendary', 'mythic', 'secret') then raise exception 'bad_ticket'; end if;
  if p_source is null or length(p_source) < 1 or length(p_source) > 40 then raise exception 'bad_source'; end if;
  if p_key is null or length(p_key) < 1 or length(p_key) > 120 then raise exception 'bad_key'; end if;
  insert into private.roll_tickets (profile_id, tier, source, grant_key, note)
  values (p_pid, p_tier, p_source, p_key, p_note)
  on conflict (profile_id, grant_key) do nothing
  returning id into v;
  if v is null then -- this grant already paid: the same ticket, never a second one
    select t.id into v from private.roll_tickets t where t.profile_id = p_pid and t.grant_key = p_key;
  end if;
  return v;
end $$;
revoke all on function private.grant_ticket(uuid, text, text, text, text) from public;
revoke all on function private.grant_ticket(uuid, text, text, text, text) from anon, authenticated;

-- 060's pick, unchanged but for the floor's range (SECRET = 4)
create or replace function private.pick_ticket_gear(p_pid uuid, p_floor text)
returns table (o_mark text, o_tier text)
language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare fr integer := private.tier_rank(p_floor); s double precision; tot double precision := 0; u double precision;
        acc double precision := 0; tw record; pick_t text := null; last_t text := null;
begin
  if fr < 0 or fr > 4 then raise exception 'bad_floor'; end if;
  -- a plain roll at luck x1: every non-RARE gear 1 / x, RARE the remainder (only a RARE+ ticket can land RARE)
  select coalesce(sum(1 / gp.x) filter (where gp.tier <> 'rare'), 0) into s from private.gear_pool gp;
  for tw in select t.tier, case when t.tier = 'rare' then greatest(0, 1 - s) else t.w end as w
              from (select gp.tier, sum(1 / gp.x) as w, min(gp.ord) as o from private.gear_pool gp group by gp.tier) t
             where private.tier_rank(t.tier) >= fr order by t.o loop
    tot := tot + tw.w;
  end loop;
  if tot <= 0 then raise exception 'empty_pool'; end if;
  u := random() * tot;
  for tw in select t.tier, case when t.tier = 'rare' then greatest(0, 1 - s) else t.w end as w
              from (select gp.tier, sum(1 / gp.x) as w, min(gp.ord) as o from private.gear_pool gp group by gp.tier) t
             where private.tier_rank(t.tier) >= fr order by t.o loop
    if tw.w > 0 then
      last_t := tw.tier;
      if u < acc + tw.w then pick_t := tw.tier; exit; end if;
      acc := acc + tw.w;
    end if;
  end loop;
  pick_t := coalesce(pick_t, last_t); -- float dust at the very end
  -- inside the tier: a gear this player does not own yet first (any one of them, evenly), else any gear of the tier
  select gp.mark_id, gp.tier into o_mark, o_tier
    from private.gear_pool gp
   where gp.tier = pick_t
   order by (exists (select 1 from private.gear_owned ow where ow.profile_id = p_pid and ow.mark_id = gp.mark_id)), random()
   limit 1;
  return next;
end $$;
revoke all on function private.pick_ticket_gear(uuid, text) from public;
revoke all on function private.pick_ticket_gear(uuid, text) from anon, authenticated;

-- ---- purchases: what kind, and the ticket a pack minted -----------------------------------------------------------------
alter table private.pay_purchases add column if not exists kind text not null default 'gems' check (kind in ('gems', 'pack'));
alter table private.pay_purchases add column if not exists ticket_tier text;
alter table private.pay_purchases add column if not exists ticket_id uuid;

-- FIRST BUY x2 is for GEMS: a pack purchase neither doubles nor uses the bonus up (088's rule, gem purchases only)
create or replace function private.first_buy_open(p_uid uuid, p_pid uuid)
returns boolean language sql stable set search_path = public, private, pg_temp as $$
  select not exists (select 1 from private.pay_first_buy where auth_uid = p_uid)
     and not exists (select 1 from private.pay_purchases
                      where kind = 'gems' and ((p_uid is not null and auth_uid = p_uid) or (p_pid is not null and profile_id = p_pid)));
$$;
revoke all on function private.first_buy_open(uuid, uuid) from public, anon, authenticated;

-- ---- service role: grant a pack (THE IDEMPOTENT WRITE: one ticket per checkout session) --------------------------------
create or replace function public.pay_grant_pack(p_session text, p_reservation uuid, p_profile uuid, p_pack text, p_tier text,
                                                 p_gems integer, p_cents integer, p_currency text, p_payment_intent text)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; m date; tk uuid;
begin
  if p_session is null or length(p_session) < 8 or length(p_session) > 100 then raise exception 'bad_session' using errcode = 'invalid_parameter_value'; end if;
  if p_tier is null or p_tier not in ('mythic', 'secret') then raise exception 'bad_tier' using errcode = 'invalid_parameter_value'; end if;
  if p_pack is null or length(p_pack) > 32 then raise exception 'bad_pack' using errcode = 'invalid_parameter_value'; end if;
  if p_gems is null or p_gems <= 0 or p_gems > 100000 then raise exception 'bad_gems' using errcode = 'invalid_parameter_value'; end if;
  if p_cents is null or p_cents <= 0 then raise exception 'bad_amount' using errcode = 'invalid_parameter_value'; end if;
  select id into pid from public.profiles where id = p_profile; -- a profile deleted mid-checkout: the purchase is kept, owner null
  select month into m from private.pay_reservations where id = p_reservation;
  insert into private.pay_purchases (stripe_session_id, profile_id, pack, gems, bonus_gems, amount_cents, currency, payment_intent,
                                     reservation_id, month, kind, ticket_tier)
  values (p_session, pid, p_pack, p_gems, 0, p_cents, coalesce(p_currency, 'usd'), p_payment_intent, p_reservation,
          coalesce(m, private.pay_month()), 'pack', p_tier)
  on conflict (stripe_session_id) do nothing;
  if not found then
    return jsonb_build_object('granted', false, 'duplicate', true); -- a retried / duplicated webhook: nothing minted
  end if;
  if pid is not null then
    tk := private.grant_ticket(pid, p_tier, 'pay', 'pay:' || p_session, p_pack);
    update private.pay_purchases set ticket_id = tk where stripe_session_id = p_session;
  end if;
  update private.pay_reservations set state = 'paid', stripe_session_id = p_session where id = p_reservation;
  return jsonb_build_object('granted', true, 'duplicate', false, 'ticket', tk is not null, 'tier', p_tier, 'orphan', pid is null);
end $$;
revoke all on function public.pay_grant_pack(text, uuid, uuid, text, text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.pay_grant_pack(text, uuid, uuid, text, text, integer, integer, text, text) to service_role;

-- ---- service role: claw (refund / dispute) - 086's pay_claw2 + the pack branch ------------------------------------------
create or replace function public.pay_claw2(p_payment_intent text, p_ratio numeric, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pur private.pay_purchases; r jsonb; cents integer; t private.roll_tickets;
begin
  if p_reason is null or p_reason not in ('refund', 'dispute') then raise exception 'bad_reason' using errcode = 'invalid_parameter_value'; end if;
  select * into pur from private.pay_purchases where payment_intent = p_payment_intent for update;
  if not found then return jsonb_build_object('found', false); end if;
  -- 089: a ROLL PACK. Unopened: revoke the ticket. Opened (or gone): fall through to the gem clawback below.
  if pur.kind = 'pack' then
    if p_reason = 'refund' and coalesce(p_ratio, 0) <= 0 then
      return jsonb_build_object('found', true, 'clawed', 0); -- nothing was refunded
    end if;
    if pur.ticket_id is not null then
      select * into t from private.roll_tickets where id = pur.ticket_id for update;
    end if;
    if t.id is not null and t.state in ('owned', 'revoked') then
      update private.roll_tickets set state = 'revoked' where id = t.id and state = 'owned';
      update private.pay_purchases
         set status = case when p_reason = 'dispute' or status = 'disputed' then 'disputed' else 'refunded' end, updated_at = now()
       where stripe_session_id = pur.stripe_session_id;
      if p_reason = 'dispute' then
        if pur.profile_id is not null then
          insert into private.pay_flags (profile_id, reason) values (pur.profile_id, 'dispute') on conflict (profile_id) do nothing;
        end if;
        if pur.auth_uid is not null then
          insert into private.pay_auth_flags (auth_uid, reason) values (pur.auth_uid, 'dispute') on conflict (auth_uid) do nothing;
        end if;
      end if;
      return jsonb_build_object('found', true, 'clawed', 0, 'revoked', true);
    end if;
  end if;
  if p_reason = 'dispute' then
    r := public.pay_claw(p_payment_intent, null, 'dispute');
    if pur.auth_uid is not null then
      insert into private.pay_auth_flags (auth_uid, reason) values (pur.auth_uid, 'dispute') on conflict (auth_uid) do nothing;
    end if;
    return r;
  end if;
  -- the refunded SHARE of the charge (its own currency cancels out) onto the purchase's USD amount
  cents := ceil(least(greatest(coalesce(p_ratio, 0), 0), 1) * pur.amount_cents)::integer;
  return public.pay_claw(p_payment_intent, cents, 'refund');
end $$;
revoke all on function public.pay_claw2(text, numeric, text) from public, anon, authenticated;
grant execute on function public.pay_claw2(text, numeric, text) to service_role;

-- ---- the gem budget (036 / 082): the NET paid ledger, unfloored, so an opened-then-refunded pack is a debt ---------------
create or replace function private.gem_budget(p_pid uuid)
returns bigint language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.profiles; r bigint; days numeric; codes bigint := 0; weekly bigint := 0; dupes bigint := 0; paid bigint := 0;
        REBIRTH_GEMS_PER_R constant integer := 25;   -- v3/econ.js
        PER_WORD constant integer := 250;            -- drops + an 8-player winner's pot every ~10 words, x the +800% gem gear - never short for a real player
        DAILY_MAX constant integer := 3150;          -- the best daily drop (150) + WORD RACE speed gems (not in lifetime_words): 75 races x 40 a day
        ACH_TOTAL constant integer := 4130;          -- every v3 achievement tier (achievements.js)
        START_AND_GIFTS constant integer := 2000;    -- the starter grant + patch-note gifts
        SLACK constant numeric := 1.5;
begin
  select * into p from public.profiles where id = p_pid;
  if not found then return 0; end if;
  r := greatest(0, coalesce(p.rebirths, 0));
  days := greatest(1, ceil(extract(epoch from (now() - coalesce(p.created_at, now()))) / 86400.0) + 1);
  begin
    select coalesce(sum(c.gems), 0) into codes from private.redeem_claims rc join public.redeem_codes c on c.code = rc.code
     where rc.player = extensions.digest('taw-rc:p:' || p_pid::text, 'sha256') and c.kind = 'gems';
  exception when others then codes := 0; end;
  begin
    select coalesce(sum(gems), 0) into weekly from private.s2_week_prizes where profile_id = p_pid;
  exception when others then weekly := 0; end;
  select coalesce(sum(case l.tier when 'rare' then 5 when 'epic' then 25 when 'legendary' then 100 when 'mythic' then 500 when 'secret' then 2500 else 0 end), 0)
    into dupes
    from private.roll_log l
   where l.profile_id = p_pid and l.state = 'claimed'
     and exists (select 1 from private.roll_log e where e.profile_id = p_pid and e.mark_id = l.mark_id and e.state = 'claimed' and e.id < l.id);
  -- 082: the paid gems, net of refunds / disputes (never inflated by SLACK: a bought gem is exactly one gem). 089: NOT
  -- floored at 0 - an opened pack's refund claw has no matching +row, so it lowers the budget (the debt).
  begin
    select coalesce(sum(delta), 0) into paid from private.pay_gem_ledger where profile_id = p_pid;
  exception when others then paid := 0; end;
  return floor(SLACK * (REBIRTH_GEMS_PER_R * r * (r + 1) / 2 + PER_WORD * greatest(0, coalesce(p.lifetime_words, 0))
                        + DAILY_MAX * days + ACH_TOTAL + START_AND_GIFTS + codes + weekly + dupes))::bigint
         + paid;
end $$;
revoke all on function private.gem_budget(uuid) from public;
revoke all on function private.gem_budget(uuid) from anon, authenticated;

notify pgrst, 'reload schema';

-- ADMIN (SQL editor). SEE every pack bought, its ticket and what it opened into:
--   select p.username, pp.pack, pp.amount_cents, pp.status, pp.created_at, t.state, t.pick_tier, t.mark_id, t.shiny, t.spent_at
--     from private.pay_purchases pp left join public.profiles p on p.id = pp.profile_id
--     left join private.roll_tickets t on t.id = pp.ticket_id
--    where pp.kind = 'pack' order by pp.created_at desc;
