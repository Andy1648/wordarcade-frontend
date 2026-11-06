-- 085_google_signin.sql - SIGN IN WITH GOOGLE (Andy nov4: "progress is never lost and purchases are secure"). An account
-- was a DEVICE SECRET (+ the save code). Now a board profile can also be LINKED to a Supabase Auth user (Google
-- provider), so a new device that signs in gets the same board row + cloud save, and a gem purchase is tied to the
-- Google account on the server, not only to whatever secret a browser holds.
--
--   * SIGN-IN IS OPTIONAL TO PLAY (school Google accounts often block third-party sign-in; kids are never forced).
--     It is REQUIRED TO BUY GEMS: pay_reserve (082) now refuses unless the checkout's auth user is linked to the
--     secret's profile (api/checkout.js verifies the Google session against /auth/v1/user and passes its uid).
--   * NO PII: only the auth user's uid is stored here, and the link. Google's email / name stay inside Supabase Auth
--     (auth.users) - nothing below copies them, and nothing public can read them.
--
--   private.auth_links           auth_uid -> profile_id, one to one (one Google account <-> one board row)
--   private.profile_device_secrets   EXTRA device secrets of a profile (a device restored by signing in gets its OWN
--                                secret; the other devices keep theirs). profile_for_secret now checks both tables.
--   lb_auth_status()             (signed in) is this Google account linked? -> { linked, profile_id, username, level,
--                                rebirths } (the restore confirm shows whose progress it is)
--   lb_auth_link(p_secret)       (signed in) link THIS device's profile to the Google account. Refused when the
--                                account is already linked to a different profile ('account_taken') or the profile to a
--                                different account ('profile_taken'). Linking the same pair again is ok.
--   lb_auth_restore(p_new_secret)  (signed in, linked) add this device's NEW secret to the linked profile -> { profile_id,
--                                username }. The browser then loads the cloud save with that secret (lb_load2).
--   lb_auth_unlink(p_secret)     (signed in) undo the link of this device's profile (Settings - never needed to sign out)
--   pay_reserve(secret, pack, cents, auth_uid)   082's reserve + the auth check; the 3-argument form now refuses
--                                'sign_in' so nothing can reserve without an account.
--
-- auth.uid() is Supabase's own: the uid inside the caller's access token (null for the anon key alone).
--
-- ORDER: after 082 (paid gems) and 084. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor,
-- AFTER Auth -> Providers -> Google is on (claude/payments-setup.md "SIGN IN WITH GOOGLE"). Then:
-- notify pgrst, 'reload schema';   Safe to re-run (if not exists / create or replace / the same grants). ASCII only.

-- ---- tables --------------------------------------------------------------------------------------------------------
create table if not exists private.auth_links (
  auth_uid uuid primary key,
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  linked_at timestamptz not null default now()
);
revoke all on private.auth_links from public;
revoke all on private.auth_links from anon, authenticated;

create table if not exists private.profile_device_secrets (
  secret_hash bytea primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now()
);
create index if not exists profile_device_secrets_profile on private.profile_device_secrets (profile_id);
revoke all on private.profile_device_secrets from public;
revoke all on private.profile_device_secrets from anon, authenticated;

-- ---- every secret check: the claim's secret OR a device secret added by a sign-in restore ---------------------------
create or replace function private.profile_for_secret(p_secret text)
returns uuid language sql stable as $$
  select coalesce(
    (select profile_id from private.profile_secrets where secret_hash = extensions.digest(p_secret, 'sha256')),
    (select profile_id from private.profile_device_secrets where secret_hash = extensions.digest(p_secret, 'sha256'))
  )
$$;

-- ---- lb_auth_status ------------------------------------------------------------------------------------------------
create or replace function public.lb_auth_status()
returns json language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); l private.auth_links; p public.profiles;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
  select * into l from private.auth_links where auth_uid = uid;
  if l.profile_id is null then return json_build_object('ok', true, 'linked', false); end if;
  select * into p from public.profiles where id = l.profile_id;
  return json_build_object('ok', true, 'linked', true, 'profile_id', p.id, 'username', p.username,
    'level', coalesce(p.level, 1), 'rebirths', coalesce(p.rebirths, 0));
end $$;
revoke all on function public.lb_auth_status() from public;
grant execute on function public.lb_auth_status() to authenticated;

-- ---- lb_auth_link --------------------------------------------------------------------------------------------------
create or replace function public.lb_auth_link(p_secret text)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); pid uuid; mine private.auth_links; theirs private.auth_links;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
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
  insert into private.auth_links (auth_uid, profile_id) values (uid, pid);
  return json_build_object('ok', true, 'again', false, 'profile_id', pid);
end $$;
revoke all on function public.lb_auth_link(text) from public;
grant execute on function public.lb_auth_link(text) to authenticated;

-- ---- lb_auth_restore -----------------------------------------------------------------------------------------------
create or replace function public.lb_auth_restore(p_new_secret text)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); l private.auth_links; p public.profiles; h bytea; owner uuid;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
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
revoke all on function public.lb_auth_restore(text) from public;
grant execute on function public.lb_auth_restore(text) to authenticated;

-- ---- lb_auth_unlink ------------------------------------------------------------------------------------------------
create or replace function public.lb_auth_unlink(p_secret text)
returns json language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare uid uuid := auth.uid(); pid uuid; n integer;
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'sign_in'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('ok', false, 'reason', 'no_profile'); end if;
  delete from private.auth_links where auth_uid = uid and profile_id = pid;
  get diagnostics n = row_count;
  return json_build_object('ok', true, 'unlinked', n > 0);
end $$;
revoke all on function public.lb_auth_unlink(text) from public;
grant execute on function public.lb_auth_unlink(text) to authenticated;

-- ---- PAID GEMS: a purchase needs a linked Google account (082 pay_reserve + the auth uid) --------------------------
alter table private.pay_reservations add column if not exists auth_uid uuid;
alter table private.pay_purchases add column if not exists auth_uid uuid;

-- the 3-argument reserve (082) can no longer reserve: every checkout goes through the auth check below
create or replace function public.pay_reserve(p_secret text, p_pack text, p_cents integer)
returns jsonb language sql volatile security definer set search_path = public, private, pg_temp as $$
  select jsonb_build_object('ok', false, 'reason', 'sign_in');
$$;

create or replace function public.pay_reserve(p_secret text, p_pack text, p_cents integer, p_auth_uid uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, private, pg_temp as $$
declare pid uuid; spent integer; rid uuid; cap constant integer := private.pay_cap_cents(); linked uuid;
begin
  if p_cents is null or p_cents <= 0 or p_cents > cap then raise exception 'bad_amount' using errcode = 'invalid_parameter_value'; end if;
  if p_pack is null or length(p_pack) > 32 then raise exception 'bad_pack' using errcode = 'invalid_parameter_value'; end if;
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  -- 085: the Google account the checkout signed in with must be THIS profile's linked account
  if p_auth_uid is null then return jsonb_build_object('ok', false, 'reason', 'sign_in'); end if;
  select profile_id into linked from private.auth_links where auth_uid = p_auth_uid;
  if linked is null or linked <> pid then return jsonb_build_object('ok', false, 'reason', 'not_linked'); end if;
  if exists (select 1 from private.pay_flags where profile_id = pid) then
    return jsonb_build_object('ok', false, 'reason', 'flagged');
  end if;
  perform pg_advisory_xact_lock(hashtext('taw-pay:' || pid::text));
  spent := private.pay_month_cents(pid);
  if spent + p_cents > cap then
    return jsonb_build_object('ok', false, 'reason', 'cap', 'spent_cents', spent, 'cap_cents', cap);
  end if;
  insert into private.pay_reservations (profile_id, pack, amount_cents, month, expires_at, auth_uid)
  values (pid, p_pack, p_cents, private.pay_month(), now() + interval '35 minutes', p_auth_uid)
  returning id into rid;
  return jsonb_build_object('ok', true, 'profile_id', pid, 'reservation', rid, 'spent_cents', spent, 'cap_cents', cap);
end $$;

-- a recorded purchase carries the Google account its reservation was made with (082's pay_grant is unchanged)
create or replace function private.pay_purchase_auth()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if new.auth_uid is null and new.reservation_id is not null then
    select auth_uid into new.auth_uid from private.pay_reservations where id = new.reservation_id;
  end if;
  return new;
end $$;
drop trigger if exists pay_purchase_auth on private.pay_purchases;
create trigger pay_purchase_auth before insert on private.pay_purchases for each row execute function private.pay_purchase_auth();

revoke all on function public.pay_reserve(text, text, integer) from public, anon, authenticated;
revoke all on function public.pay_reserve(text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.pay_reserve(text, text, integer) to service_role;
grant execute on function public.pay_reserve(text, text, integer, uuid) to service_role;
revoke all on function private.pay_purchase_auth() from public, anon, authenticated;
