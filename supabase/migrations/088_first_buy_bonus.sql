-- 088_first_buy_bonus.sql - FIRST BUY: DOUBLE GEMS (Andy nov6). Once per Google account, on whichever pack it buys first. The
-- SERVER decides at grant time; nothing the client sends can claim it.
--
--   * WHO: a purchase whose reservation carries a Google account (085) with no earlier purchase, on an account or a board
--     profile that has never bought. Purchases made before this file ran count as "earlier", so nobody who has already
--     bought gets one.
--   * ONCE, FOR GOOD: private.pay_first_buy has one row per Google account, kept forever. A refund does NOT free it, so
--     refund then rebuy can't farm the bonus. The profile check stops a new Google account linked to the same name.
--   * WHAT IT PAYS: pay_purchases.gems holds the pack + the bonus, and one ledger row carries both. So 082's pay_claw and 086's
--     pay_claw2 take the bonus back with no change: a full refund claws all of it, a partial refund its share, a dispute
--     everything. gem_budget sums the ledger, so it follows too.
--   * RETRIES AND RACES: a re-sent webhook for the same session returns 'duplicate' before anything else. Two checkouts
--     landing together queue on an advisory lock per account, and the table's primary key is the second guard.
--   * pay_grant keeps its signature, so the webhook is unchanged: amount checks stay in api/_lib/pay.js grantArgs.
--   * pay_first_buy_open(secret) says whether to show the stamp. The client treats a missing function as "no", so the stamp
--     and the bonus both stay off until this file has run, in whichever order the client and this file ship.
--
-- ORDER: after 082, 085 and 086. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run
-- (if not exists / create or replace / the same grants). ASCII only.

alter table private.pay_purchases add column if not exists bonus_gems integer not null default 0 check (bonus_gems >= 0);

create table if not exists private.pay_first_buy (
  auth_uid uuid primary key,
  stripe_session_id text not null references private.pay_purchases (stripe_session_id),
  created_at timestamptz not null default now()
);
revoke all on private.pay_first_buy from public;
revoke all on private.pay_first_buy from anon, authenticated;

-- may this account / profile still get the bonus? (either may be null: signed out, or no name yet)
create or replace function private.first_buy_open(p_uid uuid, p_pid uuid)
returns boolean language sql stable set search_path = public, private, pg_temp as $$
  select not exists (select 1 from private.pay_first_buy where auth_uid = p_uid)
     and not exists (select 1 from private.pay_purchases
                      where (p_uid is not null and auth_uid = p_uid) or (p_pid is not null and profile_id = p_pid));
$$;
revoke all on function private.first_buy_open(uuid, uuid) from public, anon, authenticated;

-- ---- service role: grant (082's idempotent write + the bonus) ----------------------------------------------------------
create or replace function public.pay_grant(p_session text, p_reservation uuid, p_profile uuid, p_pack text, p_gems integer,
                                            p_cents integer, p_currency text, p_payment_intent text)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; m date; uid uuid; bonus integer := 0;
begin
  if p_session is null or length(p_session) < 8 then raise exception 'bad_session' using errcode = 'invalid_parameter_value'; end if;
  if p_gems is null or p_gems <= 0 or p_gems > 100000 then raise exception 'bad_gems' using errcode = 'invalid_parameter_value'; end if;
  if p_cents is null or p_cents <= 0 then raise exception 'bad_amount' using errcode = 'invalid_parameter_value'; end if;
  select id into pid from public.profiles where id = p_profile; -- a profile deleted mid-checkout: the purchase is kept, owner null
  select month, auth_uid into m, uid from private.pay_reservations where id = p_reservation;
  -- one grant at a time per Google account decides the bonus (two checkouts landing together queue here)
  if uid is not null then perform pg_advisory_xact_lock(hashtext('taw-first-buy:' || uid::text)); end if;
  if exists (select 1 from private.pay_purchases where stripe_session_id = p_session) then
    return jsonb_build_object('granted', false, 'duplicate', true); -- a retry, before any bonus is considered
  end if;
  if uid is not null and private.first_buy_open(uid, pid) then bonus := p_gems; end if;
  insert into private.pay_purchases (stripe_session_id, profile_id, pack, gems, bonus_gems, amount_cents, currency, payment_intent, reservation_id, month)
  values (p_session, pid, p_pack, p_gems + bonus, bonus, p_cents, coalesce(p_currency, 'usd'), p_payment_intent, p_reservation, coalesce(m, private.pay_month()))
  on conflict (stripe_session_id) do nothing;
  if not found then
    return jsonb_build_object('granted', false, 'duplicate', true);
  end if;
  if bonus > 0 then
    insert into private.pay_first_buy (auth_uid, stripe_session_id) values (uid, p_session) on conflict (auth_uid) do nothing;
    if not found then -- the primary key beat the lock's check: this purchase pays the pack alone
      update private.pay_purchases set gems = p_gems, bonus_gems = 0 where stripe_session_id = p_session;
      bonus := 0;
    end if;
  end if;
  insert into private.pay_gem_ledger (profile_id, delta, reason, stripe_session_id) values (pid, p_gems + bonus, 'purchase', p_session);
  update private.pay_reservations set state = 'paid', stripe_session_id = p_session where id = p_reservation;
  return jsonb_build_object('granted', true, 'duplicate', false, 'gems', p_gems + bonus, 'bonus', bonus, 'orphan', pid is null);
end $$;

-- ---- the player: show the stamp? (a guess for the panel; pay_grant alone decides) --------------------------------------
create or replace function public.pay_first_buy_open(p_secret text default null)
returns boolean language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); pid uuid;
begin
  if p_secret is not null and length(p_secret) between 32 and 128 then pid := private.profile_for_secret(p_secret); end if;
  if uid is null and pid is not null then select auth_uid into uid from private.auth_links where profile_id = pid; end if;
  if pid is null and uid is not null then select profile_id into pid from private.auth_links where auth_uid = uid; end if;
  return private.first_buy_open(uid, pid);
end $$;
revoke all on function public.pay_first_buy_open(text) from public;
grant execute on function public.pay_first_buy_open(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
