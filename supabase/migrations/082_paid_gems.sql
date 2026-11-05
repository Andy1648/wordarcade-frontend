-- 082_paid_gems.sql — PAID GEMS (Andy nov3: "pay-to-win" gems, bought with real money through Stripe Checkout).
--
-- WHAT IT ADDS
--   private.pay_reservations  a checkout in flight: holds its dollars against the monthly cap until it is paid, released
--                             (checkout.session.expired / Stripe trouble) or 35 minutes old (the session lives 30).
--   private.pay_purchases     ONE ROW PER STRIPE CHECKOUT SESSION (stripe_session_id is the primary key). This is the
--                             webhook's idempotency: a retried / duplicated checkout.session.completed inserts nothing
--                             and grants nothing. Kept even if the profile is deleted (profile_id goes null): it is a
--                             money record.
--   private.pay_gem_ledger    THE PAID-GEMS LEDGER: +gems per purchase, −gems per refund / dispute claw. delivered_at is
--                             set when the player's browser has applied the row (gems live client-side, like every gem —
--                             gemsCore). The server never forgets a row: pay_gems_pending hands it out until acked.
--   private.pay_flags         an account with a dispute (chargeback): no more checkouts.
--   private.gem_budget        re-declared from 036 (unchanged) + the NET paid gems, so the server's roll / ticket budget
--                             lets paid gems spend exactly like earned ones — the SAME server odds (lb_roll picks with
--                             private.pick_gear whatever paid for the roll).
--
-- RPCs
--   service role ONLY (the Vercel functions api/checkout.js + api/stripe-webhook.js, key SUPABASE_SERVICE_ROLE_KEY):
--     pay_reserve(secret, pack, cents)   the profile behind the secret + THE MONTHLY CAP, under a per-profile lock
--     pay_release(reservation)           a checkout that will never be paid frees its share of the cap
--     pay_grant(session, …)              record the purchase once + ledger +gems
--     pay_claw(payment_intent, refunded_cents, reason)   ledger −gems for a refund (pro rata) or a dispute (all)
--   the player (anon, proves the secret like every lb_ write):
--     pay_gems_pending(secret)           undelivered ledger rows + this month's spend and cap (the shelf's "left" line)
--     pay_gems_ack(secret, ids)          the browser applied these rows
--
-- THE CAP: $20.00 (2000 cents) per profile per calendar month, America/New_York (the board's week clock). It counts
-- every purchase made this month — REFUNDED ONES INCLUDED, so buy → refund → buy cannot run past it — plus the open
-- reservations. MIRRORED in src/payments/packs.js MONTHLY_CAP_CENTS (packs.test.js pins the two together).
--
-- CLAWBACK — FLOORED AT 0 ON THE DEVICE, THE DEBT KEPT ON THE SERVER (the decision, documented):
--   A refund / dispute writes a NEGATIVE ledger row. The browser takes those gems off its balance but never below 0
--   (gemsCore balances are whole numbers ≥ 0 everywhere). Gems already SPENT before the refund are not lost to us,
--   though: gem_budget below counts the net paid gems, so the refunded amount leaves the account's server budget and
--   server-side rolls / sealed tickets stay refused (lb_roll / lb_ticket_buy 'budget') until the player has EARNED
--   that much again. A dispute also flags the account (no more purchases). A refund scales with the money returned:
--   a partial refund claws ceil(gems × refunded / paid); claws are cumulative per purchase, so a retry or a second
--   partial refund only claws what is newly owed.
--
-- ORDER: after 001 (profile_for_secret), 036 (gem_budget) and every later file. Then: notify pgrst, 'reload schema';
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- tables --------------------------------------------------------------------------------------------------------
create table if not exists private.pay_reservations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pack text not null,
  amount_cents integer not null check (amount_cents > 0),
  month date not null,
  state text not null default 'open' check (state in ('open', 'paid', 'released')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists pay_reservations_open on private.pay_reservations (profile_id, month) where state = 'open';

create table if not exists private.pay_purchases (
  stripe_session_id text primary key,                         -- THE IDEMPOTENCY KEY: one grant per checkout session
  profile_id uuid references public.profiles(id) on delete set null,
  pack text not null,
  gems integer not null check (gems > 0),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  payment_intent text unique,
  reservation_id uuid,
  month date not null,
  status text not null default 'granted' check (status in ('granted', 'partly_refunded', 'refunded', 'disputed')),
  clawed_gems integer not null default 0 check (clawed_gems >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pay_purchases_month on private.pay_purchases (profile_id, month);

create table if not exists private.pay_gem_ledger (
  id bigserial primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('purchase', 'refund', 'dispute')),
  stripe_session_id text not null references private.pay_purchases(stripe_session_id),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists pay_gem_ledger_pending on private.pay_gem_ledger (profile_id, id) where delivered_at is null;
create index if not exists pay_gem_ledger_profile on private.pay_gem_ledger (profile_id);

create table if not exists private.pay_flags (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null,
  flagged_at timestamptz not null default now()
);

revoke all on private.pay_reservations, private.pay_purchases, private.pay_gem_ledger, private.pay_flags from public;
revoke all on private.pay_reservations, private.pay_purchases, private.pay_gem_ledger, private.pay_flags from anon, authenticated;
revoke all on sequence private.pay_gem_ledger_id_seq from public, anon, authenticated;

-- ---- helpers -------------------------------------------------------------------------------------------------------
create or replace function private.pay_month(p_at timestamptz default now())
returns date language sql stable as $$
  select (date_trunc('month', p_at at time zone 'America/New_York'))::date;
$$;
revoke all on function private.pay_month(timestamptz) from public, anon, authenticated;

create or replace function private.pay_cap_cents()
returns integer language sql immutable as $$ select 2000 $$; -- CAP_CENTS: $20.00 (src/payments/packs.js MONTHLY_CAP_CENTS)
revoke all on function private.pay_cap_cents() from public, anon, authenticated;

-- this month's spend: every purchase (refunded too) + every open, unexpired reservation
create or replace function private.pay_month_cents(p_pid uuid)
returns integer language sql stable security definer set search_path = public, private, pg_temp as $$
  select (coalesce((select sum(amount_cents) from private.pay_purchases
                     where profile_id = p_pid and month = private.pay_month()), 0)
        + coalesce((select sum(amount_cents) from private.pay_reservations
                     where profile_id = p_pid and month = private.pay_month() and state = 'open' and expires_at > now()), 0))::integer;
$$;
revoke all on function private.pay_month_cents(uuid) from public, anon, authenticated;

-- ---- service role: reserve (THE CAP) -------------------------------------------------------------------------------
create or replace function public.pay_reserve(p_secret text, p_pack text, p_cents integer)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; spent integer; rid uuid; cap constant integer := private.pay_cap_cents();
begin
  if p_cents is null or p_cents <= 0 or p_cents > cap then raise exception 'bad_amount' using errcode = 'invalid_parameter_value'; end if;
  if p_pack is null or length(p_pack) > 32 then raise exception 'bad_pack' using errcode = 'invalid_parameter_value'; end if;
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if exists (select 1 from private.pay_flags where profile_id = pid) then
    return jsonb_build_object('ok', false, 'reason', 'flagged');
  end if;
  -- one checkout at a time per profile decides the cap (two tabs can't both squeeze under it)
  perform pg_advisory_xact_lock(hashtext('taw-pay:' || pid::text));
  spent := private.pay_month_cents(pid);
  if spent + p_cents > cap then
    return jsonb_build_object('ok', false, 'reason', 'cap', 'spent_cents', spent, 'cap_cents', cap);
  end if;
  insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at)
  values (pid, p_pack, p_cents, private.pay_month(), now() + interval '35 minutes')
  returning id into rid;
  return jsonb_build_object('ok', true, 'profile_id', pid, 'reservation', rid, 'spent_cents', spent, 'cap_cents', cap);
end $$;

create or replace function public.pay_release(p_reservation uuid)
returns jsonb language sql volatile security definer set search_path = public, private, pg_temp as $$
  with u as (update private.pay_reservations set state = 'released' where id = p_reservation and state = 'open' returning 1)
  select jsonb_build_object('released', exists (select 1 from u));
$$;

-- ---- service role: grant (THE IDEMPOTENT WRITE) ---------------------------------------------------------------------
create or replace function public.pay_grant(p_session text, p_reservation uuid, p_profile uuid, p_pack text, p_gems integer,
                                            p_cents integer, p_currency text, p_payment_intent text)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; m date;
begin
  if p_session is null or length(p_session) < 8 then raise exception 'bad_session' using errcode = 'invalid_parameter_value'; end if;
  if p_gems is null or p_gems <= 0 or p_gems > 100000 then raise exception 'bad_gems' using errcode = 'invalid_parameter_value'; end if;
  if p_cents is null or p_cents <= 0 then raise exception 'bad_amount' using errcode = 'invalid_parameter_value'; end if;
  select id into pid from public.profiles where id = p_profile; -- a profile deleted mid-checkout: the purchase is kept, owner null
  select month into m from private.pay_reservations where id = p_reservation;
  insert into private.pay_purchases (stripe_session_id, profile_id, pack, gems, amount_cents, currency, payment_intent, reservation_id, month)
  values (p_session, pid, p_pack, p_gems, p_cents, coalesce(p_currency, 'usd'), p_payment_intent, p_reservation, coalesce(m, private.pay_month()))
  on conflict (stripe_session_id) do nothing;
  if not found then
    return jsonb_build_object('granted', false, 'duplicate', true);
  end if;
  insert into private.pay_gem_ledger (profile_id, delta, reason, stripe_session_id) values (pid, p_gems, 'purchase', p_session);
  update private.pay_reservations set state = 'paid', stripe_session_id = p_session where id = p_reservation;
  return jsonb_build_object('granted', true, 'duplicate', false, 'gems', p_gems, 'orphan', pid is null);
end $$;

-- ---- service role: claw (refund / dispute) --------------------------------------------------------------------------
create or replace function public.pay_claw(p_payment_intent text, p_refunded_cents integer, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pur private.pay_purchases; target integer; owed integer;
begin
  if p_reason is null or p_reason not in ('refund', 'dispute') then raise exception 'bad_reason' using errcode = 'invalid_parameter_value'; end if;
  select * into pur from private.pay_purchases where payment_intent = p_payment_intent for update;
  if not found then return jsonb_build_object('found', false); end if;
  if p_reason = 'dispute' then
    target := pur.gems;
  else
    target := least(pur.gems, ceil(pur.gems * least(greatest(coalesce(p_refunded_cents, 0), 0), pur.amount_cents)::numeric / pur.amount_cents)::integer);
  end if;
  owed := greatest(0, target - pur.clawed_gems);
  if owed > 0 then
    insert into private.pay_gem_ledger (profile_id, delta, reason, stripe_session_id)
    values (pur.profile_id, -owed, p_reason, pur.stripe_session_id);
  end if;
  update private.pay_purchases
     set clawed_gems = greatest(clawed_gems, target),
         status = case when p_reason = 'dispute' or status = 'disputed' then 'disputed'
                       when greatest(clawed_gems, target) >= gems then 'refunded'
                       when greatest(clawed_gems, target) > 0 then 'partly_refunded'
                       else status end,
         updated_at = now()
   where stripe_session_id = pur.stripe_session_id;
  if p_reason = 'dispute' and pur.profile_id is not null then
    insert into private.pay_flags (profile_id, reason) values (pur.profile_id, 'dispute') on conflict (profile_id) do nothing;
  end if;
  return jsonb_build_object('found', true, 'clawed', owed, 'clawed_total', greatest(pur.clawed_gems, target));
end $$;

-- service role only: nobody else may reserve, grant, release or claw
revoke all on function public.pay_reserve(text, text, integer) from public, anon, authenticated;
revoke all on function public.pay_release(uuid) from public, anon, authenticated;
revoke all on function public.pay_grant(text, uuid, uuid, text, integer, integer, text, text) from public, anon, authenticated;
revoke all on function public.pay_claw(text, integer, text) from public, anon, authenticated;
grant execute on function public.pay_reserve(text, text, integer) to service_role;
grant execute on function public.pay_release(uuid) to service_role;
grant execute on function public.pay_grant(text, uuid, uuid, text, integer, integer, text, text) to service_role;
grant execute on function public.pay_claw(text, integer, text) to service_role;

-- ---- the player: pick up paid gems (and claws), then ack them --------------------------------------------------------
create or replace function public.pay_gems_pending(p_secret text)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then
    return jsonb_build_object('rows', '[]'::jsonb, 'spent_cents', 0, 'cap_cents', private.pay_cap_cents(), 'flagged', false, 'profile', false);
  end if;
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'delta', l.delta, 'reason', l.reason) order by l.id)
                        from private.pay_gem_ledger l where l.profile_id = pid and l.delivered_at is null), '[]'::jsonb),
    'spent_cents', private.pay_month_cents(pid),
    'cap_cents', private.pay_cap_cents(),
    'flagged', exists (select 1 from private.pay_flags where profile_id = pid),
    'profile', true);
end $$;

create or replace function public.pay_gems_ack(p_secret text, p_ids bigint[])
returns integer language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; n integer;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null or p_ids is null then return 0; end if;
  update private.pay_gem_ledger set delivered_at = now()
   where profile_id = pid and delivered_at is null and id = any (p_ids[1:200]);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.pay_gems_pending(text) from public;
revoke all on function public.pay_gems_ack(text, bigint[]) from public;
grant execute on function public.pay_gems_pending(text) to anon, authenticated, service_role;
grant execute on function public.pay_gems_ack(text, bigint[]) to anon, authenticated, service_role;

-- ---- the gem budget (036), + the NET paid gems: paid gems roll at the same server odds -------------------------------
create or replace function private.gem_budget(p_pid uuid)
returns bigint language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare p public.profiles; r bigint; days numeric; codes bigint := 0; weekly bigint := 0; dupes bigint := 0; paid bigint := 0;
        REBIRTH_GEMS_PER_R constant integer := 25;   -- v3/econ.js
        PER_WORD constant integer := 250;            -- drops + an 8-player winner's pot every ~10 words, × the +800% gem gear — never short for a real player
        DAILY_MAX constant integer := 3150;          -- the best daily drop (150) + WORD RACE speed gems (not in lifetime_words): 75 races × 40 a day
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
  -- 082: the paid gems, net of refunds / disputes (never inflated by SLACK: a bought gem is exactly one gem)
  begin
    select coalesce(sum(delta), 0) into paid from private.pay_gem_ledger where profile_id = p_pid;
  exception when others then paid := 0; end;
  return floor(SLACK * (REBIRTH_GEMS_PER_R * r * (r + 1) / 2 + PER_WORD * greatest(0, coalesce(p.lifetime_words, 0))
                        + DAILY_MAX * days + ACH_TOTAL + START_AND_GIFTS + codes + weekly + dupes))::bigint
         + greatest(0, paid);
end $$;
revoke all on function private.gem_budget(uuid) from public;
revoke all on function private.gem_budget(uuid) from anon, authenticated;

notify pgrst, 'reload schema';
