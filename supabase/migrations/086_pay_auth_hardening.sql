-- 086_pay_auth_hardening.sql - the security review of paid gems (082) + SIGN IN WITH GOOGLE (085), nov4
-- (side-session-notes security-review-pay-auth.md). The client half (PKCE, the LINK confirm, the hash scrub) is in the
-- same PR; this file is the server half.
--
--   * GOOGLE ONLY (review LOW 3 + HIGH 2 hardening): every lb_auth_* RPC and pay_reserve's account must be a real Google
--     sign-in - private.auth_is_google() reads the caller's token (app_metadata.provider = 'google', not anonymous).
--     An email / anonymous Supabase session gets 'google_only'. (Also: switch email + anonymous sign-ins OFF in Supabase -
--     claude/payments-setup.md 1b.) api/checkout.js checks the same provider on /auth/v1/user.
--   * UNLINK REVOKES THE RESTORED DEVICES (MED 3): lb_auth_unlink deletes every EXTRA device secret of the profile
--     (profile_device_secrets - the ones sign-in restores added), keeping only the caller's own, so a stolen-then-
--     restored device loses the row the moment the owner unlinks.
--   * RELINK WAIT (MED 4): a Google account that unlinked, or a profile that was unlinked, can't link again for 30 days
--     ('relink_wait') - no hopping a fresh account onto a row (or a row onto a fresh account) to reset a cap or a flag.
--   * CAP + DISPUTE FLAG BY GOOGLE ACCOUNT TOO (MED 4): pay_reserve counts this month's purchases + open reservations of
--     the PROFILE OR THE GOOGLE ACCOUNT, and refuses when either is flagged. A dispute now flags the purchase's Google
--     account as well (private.pay_auth_flags).
--   * REFUND CLAW BY RATIO (MED 5): under Stripe Adaptive Pricing a charge's amount_refunded is in the PAYER's currency,
--     not our USD amount_cents. The webhook now sends the refunded SHARE (amount_refunded / amount, both in the charge's
--     own currency; 1 for a full refund) to pay_claw2, which scales it onto the purchase's USD amount and runs 082's
--     pay_claw (same cumulative / never-twice rules). Disputes go through pay_claw2 too (that is where the auth flag is).
--
-- ORDER: after 085. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor, then
-- notify pgrst, 'reload schema';   Safe to re-run (if not exists / create or replace / the same grants). ASCII only.

-- ---- tables --------------------------------------------------------------------------------------------------------
create table if not exists private.pay_auth_flags (
  auth_uid uuid primary key,
  reason text not null,
  flagged_at timestamptz not null default now()
);
revoke all on private.pay_auth_flags from public;
revoke all on private.pay_auth_flags from anon, authenticated;

create table if not exists private.auth_unlinks (
  id bigserial primary key,
  auth_uid uuid not null,
  profile_id uuid,
  unlinked_at timestamptz not null default now()
);
create index if not exists auth_unlinks_uid on private.auth_unlinks (auth_uid, unlinked_at desc);
create index if not exists auth_unlinks_profile on private.auth_unlinks (profile_id, unlinked_at desc);
revoke all on private.auth_unlinks from public;
revoke all on private.auth_unlinks from anon, authenticated;
revoke all on sequence private.auth_unlinks_id_seq from public, anon, authenticated;

-- ---- is the caller a real Google sign-in? --------------------------------------------------------------------------
create or replace function private.auth_is_google()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
$$;
revoke all on function private.auth_is_google() from public, anon, authenticated;

create or replace function private.relink_wait(p_uid uuid, p_pid uuid)
returns boolean language sql stable as $$
  select exists (select 1 from private.auth_unlinks
                  where (auth_uid = p_uid or profile_id = p_pid) and unlinked_at > now() - interval '30 days')
$$;
revoke all on function private.relink_wait(uuid, uuid) from public, anon, authenticated;

-- ---- lb_auth_status / link / restore / unlink (085, hardened) -------------------------------------------------------
create or replace function public.lb_auth_status()
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); l private.auth_links; p public.profiles;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
  if not private.auth_is_google() then return json_build_object('ok', false, 'reason', 'google_only'); end if;
  select * into l from private.auth_links where auth_uid = uid;
  if l.profile_id is null then return json_build_object('ok', true, 'linked', false); end if;
  select * into p from public.profiles where id = l.profile_id;
  return json_build_object('ok', true, 'linked', true, 'profile_id', p.id, 'username', p.username,
    'level', coalesce(p.level, 1), 'rebirths', coalesce(p.rebirths, 0));
end $$;

create or replace function public.lb_auth_link(p_secret text)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); pid uuid; mine private.auth_links; theirs private.auth_links;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
  if not private.auth_is_google() then return json_build_object('ok', false, 'reason', 'google_only'); end if;
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  perform pg_advisory_xact_lock(hashtext('taw-auth:' || uid::text));
  select * into mine from private.auth_links where auth_uid = uid;
  if mine.profile_id is not null then
    if mine.profile_id = pid then return json_build_object('ok', true, 'again', true, 'profile_id', pid); end if;
    return json_build_object('ok', false, 'reason', 'account_taken', 'profile_id', mine.profile_id);
  end if;
  select * into theirs from private.auth_links where profile_id = pid;
  if theirs.auth_uid is not null then return json_build_object('ok', false, 'reason', 'profile_taken'); end if;
  if private.relink_wait(uid, pid) then return json_build_object('ok', false, 'reason', 'relink_wait'); end if;
  insert into private.auth_links (auth_uid, profile_id) values (uid, pid);
  return json_build_object('ok', true, 'again', false, 'profile_id', pid);
end $$;

create or replace function public.lb_auth_restore(p_new_secret text)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); l private.auth_links; p public.profiles; h bytea; owner uuid;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
  if not private.auth_is_google() then return json_build_object('ok', false, 'reason', 'google_only'); end if;
  if p_new_secret is null or length(p_new_secret) < 32 or length(p_new_secret) > 128 then raise exception 'bad_secret'; end if;
  select * into l from private.auth_links where auth_uid = uid;
  if l.profile_id is null then return json_build_object('ok', false, 'reason', 'not_linked'); end if;
  h := extensions.digest(p_new_secret, 'sha256');
  owner := private.profile_for_secret(p_new_secret);
  if owner is not null and owner <> l.profile_id then return json_build_object('ok', false, 'reason', 'secret_taken'); end if;
  if owner is null then
    insert into private.profile_device_secrets (secret_hash, profile_id) values (h, l.profile_id);
  end if;
  select * into p from public.profiles where id = l.profile_id;
  return json_build_object('ok', true, 'profile_id', p.id, 'username', p.username);
end $$;

create or replace function public.lb_auth_unlink(p_secret text)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); pid uuid; n integer; revoked integer := 0; mine bytea;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
  if not private.auth_is_google() then return json_build_object('ok', false, 'reason', 'google_only'); end if;
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  delete from private.auth_links where auth_uid = uid and profile_id = pid;
  get diagnostics n = row_count;
  if n > 0 then
    -- every device the sign-in restored onto this row loses it; the caller's own secret stays
    mine := extensions.digest(p_secret, 'sha256');
    delete from private.profile_device_secrets where profile_id = pid and secret_hash <> mine;
    get diagnostics revoked = row_count;
    insert into private.auth_unlinks (auth_uid, profile_id) values (uid, pid);
  end if;
  return json_build_object('ok', true, 'unlinked', n > 0, 'devices_revoked', revoked);
end $$;

revoke all on function public.lb_auth_status() from public;
revoke all on function public.lb_auth_link(text) from public;
revoke all on function public.lb_auth_restore(text) from public;
revoke all on function public.lb_auth_unlink(text) from public;
grant execute on function public.lb_auth_status() to authenticated;
grant execute on function public.lb_auth_link(text) to authenticated;
grant execute on function public.lb_auth_restore(text) to authenticated;
grant execute on function public.lb_auth_unlink(text) to authenticated;

-- ---- pay_reserve: the cap + the flags by profile OR Google account --------------------------------------------------
create or replace function public.pay_reserve(p_secret text, p_pack text, p_cents integer, p_auth_uid uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; spent integer; rid uuid; cap constant integer := private.pay_cap_cents(); linked uuid; mon date := private.pay_month();
begin
  if p_cents is null or p_cents <= 0 or p_cents > cap then raise exception 'bad_amount' using errcode = 'invalid_parameter_value'; end if;
  if p_pack is null or length(p_pack) > 32 then raise exception 'bad_pack' using errcode = 'invalid_parameter_value'; end if;
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if p_auth_uid is null then return jsonb_build_object('ok', false, 'reason', 'sign_in'); end if;
  select profile_id into linked from private.auth_links where auth_uid = p_auth_uid;
  if linked is null or linked <> pid then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  if exists (select 1 from private.pay_flags where profile_id = pid)
     or exists (select 1 from private.pay_auth_flags where auth_uid = p_auth_uid) then
    return jsonb_build_object('ok', false, 'reason', 'flagged');
  end if;
  -- one checkout at a time per Google account AND per profile decides the cap
  perform pg_advisory_xact_lock(hashtext('taw-pay-uid:' || p_auth_uid::text));
  perform pg_advisory_xact_lock(hashtext('taw-pay:' || pid::text));
  spent := coalesce((select sum(amount_cents) from private.pay_purchases
                      where month = mon and (profile_id = pid or auth_uid = p_auth_uid)), 0)
         + coalesce((select sum(amount_cents) from private.pay_reservations
                      where month = mon and state = 'open' and expires_at > now() and (profile_id = pid or auth_uid = p_auth_uid)), 0);
  if spent + p_cents > cap then
    return jsonb_build_object('ok', false, 'reason', 'cap', 'spent_cents', spent, 'cap_cents', cap);
  end if;
  insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at, auth_uid)
  values (pid, p_pack, p_cents, mon, now() + interval '35 minutes', p_auth_uid)
  returning id into rid;
  return jsonb_build_object('ok', true, 'profile_id', pid, 'reservation', rid, 'spent_cents', spent, 'cap_cents', cap);
end $$;
revoke all on function public.pay_reserve(text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.pay_reserve(text, text, integer, uuid) to service_role;

-- ---- pay_claw2: refunds by RATIO (Adaptive Pricing), disputes flag the Google account too ---------------------------
create or replace function public.pay_claw2(p_payment_intent text, p_ratio numeric, p_reason text)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pur private.pay_purchases; r jsonb; cents integer;
begin
  if p_reason is null or p_reason not in ('refund', 'dispute') then raise exception 'bad_reason' using errcode = 'invalid_parameter_value'; end if;
  select * into pur from private.pay_purchases where payment_intent = p_payment_intent;
  if not found then return jsonb_build_object('found', false); end if;
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
