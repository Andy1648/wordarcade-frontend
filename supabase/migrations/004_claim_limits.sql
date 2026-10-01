-- 004_claim_limits.sql — STEP 47 anti-abuse: rate-limit name claims server-side, 1 rename per day.
--
-- The client can be bypassed, so the limits live in lb_claim itself:
--   * NEW names: <= 3 per IP-hash per hour and <= 10 per IP-hash per day. Clearing storage makes a new
--     browser secret, so the IP is the only thing that ties a name-squatting spree together. The IP is
--     read from the PostgREST request headers and stored ONLY as a SHA-256 hash.
--   * PER BROWSER: a secret owns at most one profile (001), and may RENAME it once per 24 h
--     (profiles.name_changed_at). A per-call budget was considered and dropped: a refused claim raises,
--     which rolls back any log row written in the same call, and lb_name_status already answers
--     "is this name free" without a secret, so throttling lb_claim calls would protect nothing.
-- lb_submit is unchanged: 003's per-row 5 s submitted_at throttle already makes replays no faster.

alter table public.profiles add column if not exists name_changed_at timestamptz;

create table if not exists private.claim_log (
  id bigserial primary key,
  ip_hash bytea not null,
  secret_hash bytea not null,
  kind text not null check (kind in ('create', 'rename')),
  at timestamptz not null default now()
);
create index if not exists claim_log_ip_at on private.claim_log (ip_hash, kind, at);
create index if not exists claim_log_secret_at on private.claim_log (secret_hash, at);

-- The caller's IP, hashed. Behind Supabase's proxy the client address arrives as a header.
create or replace function private.request_ip_hash()
returns bytea language plpgsql stable as $$
declare h json; ip text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  ip := coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(h ->> 'x-real-ip', ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
  return extensions.digest('taw-lb:' || ip, 'sha256');
end $$;

create or replace function public.lb_claim(p_secret text, p_username text)
returns public.profiles language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; row public.profiles; ih bytea; sh bytea; cur text; changed timestamptz;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'bad_secret' using errcode = 'invalid_parameter_value';
  end if;
  ih := private.request_ip_hash();
  sh := extensions.digest(p_secret, 'sha256');

  delete from private.claim_log where at < now() - interval '2 days';

  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'username_shape' using errcode = 'check_violation';
  end if;
  if not public.username_is_clean(p_username) then
    raise exception 'username_blocked' using errcode = 'check_violation';
  end if;
  pid := private.profile_for_secret(p_secret);
  if exists (select 1 from public.profiles where lower(username) = lower(p_username)
             and id is distinct from pid) then
    raise exception 'username_taken' using errcode = 'unique_violation';
  end if;

  if pid is null then
    if (select count(*) from private.claim_log where ip_hash = ih and kind = 'create' and at > now() - interval '1 hour') >= 3
       or (select count(*) from private.claim_log where ip_hash = ih and kind = 'create' and at > now() - interval '1 day') >= 10 then
      raise exception 'rate_limited' using errcode = 'insufficient_privilege';
    end if;
    insert into public.profiles (username) values (p_username) returning * into row;
    insert into private.profile_secrets (profile_id, secret_hash) values (row.id, sh);
    insert into private.claim_log (ip_hash, secret_hash, kind) values (ih, sh, 'create');
  else
    select username, name_changed_at into cur, changed from public.profiles where id = pid;
    if cur = p_username then
      select * into row from public.profiles where id = pid; -- no-op: same name
      return row;
    end if;
    if changed is not null and changed > now() - interval '1 day' then
      raise exception 'rename_cooldown' using errcode = 'insufficient_privilege';
    end if;
    update public.profiles set username = p_username, name_changed_at = now(), updated_at = now()
     where id = pid returning * into row;
    insert into private.claim_log (ip_hash, secret_hash, kind) values (ih, sh, 'rename');
  end if;
  return row;
end $$;

revoke all on function public.lb_claim(text, text) from public;
grant execute on function public.lb_claim(text, text) to anon, authenticated;
revoke all on table private.claim_log from public, anon, authenticated;
