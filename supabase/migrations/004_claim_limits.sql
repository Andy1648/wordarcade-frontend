-- 004_claim_limits.sql — STEP 47 anti-abuse: server-side limits on name claims + renames, and stats
-- that can only move the way honest play moves them. (Hardened after the STEP 47 breaker review —
-- see claude/step47/review.md.)
--
-- NEW NAMES, per network: <= 20 per hour and <= 60 per day per IP-hash. Sized for a classroom on one
-- school IP, not for one person: the limit exists to stop a script squatting thousands of names.
--   * The IP is read ONLY from headers a client cannot forge through Supabase's edge: cf-connecting-ip,
--     else the LAST x-forwarded-for hop (proxies append; the FIRST entry is whatever the client sent).
--     x-real-ip is not trusted.
--   * IPv6 is bucketed by its /64 (one home network), IPv4 by the full address. Stored only hashed.
--   * No usable IP → no per-IP bucket (a shared "unknown" bucket would lock out the whole site), but a
--     SITE-WIDE ceiling of 600 new names per hour still applies to everyone.
--   * The count-then-insert runs under a per-bucket advisory lock, so a burst of parallel calls can't
--     all read "0 so far" and all pass.
-- PER BROWSER: a secret owns at most one profile (001). Renames: free within 10 minutes of the first
--   claim (fix a typo), then 1 per 24 h, checked under a row lock.
-- ERRORS are raised with the default SQLSTATE (P0001 → HTTP 400), message = the code the client maps.
-- STATS (lb_submit): still the 5 s per-row throttle (003), plus honest-play shape: rebirths and lifetime
--   words never go down, level only goes down when rebirths went up, and after the first push words
--   can grow at most 20/s of elapsed time. A push that breaks the shape is ignored, not an error.

alter table public.profiles add column if not exists name_changed_at timestamptz;

create table if not exists private.claim_log (
  id bigserial primary key,
  ip_hash bytea,
  kind text not null check (kind in ('create', 'rename')),
  at timestamptz not null default now()
);
create index if not exists claim_log_ip_at on private.claim_log (ip_hash, kind, at);
create index if not exists claim_log_kind_at on private.claim_log (kind, at);
revoke all on table private.claim_log from public, anon, authenticated;

-- The caller's network, hashed, or NULL when no trustworthy address is present.
create or replace function private.request_ip_hash()
returns bytea language plpgsql stable as $$
declare h json; ip text; xff text;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  if h is null then return null; end if;
  ip := nullif(trim(h ->> 'cf-connecting-ip'), '');
  if ip is null then
    xff := coalesce(h ->> 'x-forwarded-for', '');
    ip := nullif(trim(regexp_replace(xff, '^.*,', '')), ''); -- the LAST hop
  end if;
  if ip is null then return null; end if;
  if position(':' in ip) > 0 then
    -- IPv6: keep the first four hextets (the /64). Expands nothing; '::' forms just hash as given.
    ip := array_to_string((string_to_array(lower(ip), ':'))[1:4], ':') || '::/64';
  end if;
  return extensions.digest('taw-lb:' || ip, 'sha256');
end $$;

create or replace function public.lb_claim(p_secret text, p_username text)
returns public.profiles language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; row public.profiles; ih bytea; cur text; changed timestamptz; born timestamptz;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'bad_secret';
  end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'username_shape';
  end if;
  if not public.username_is_clean(p_username) then
    raise exception 'username_blocked';
  end if;
  pid := private.profile_for_secret(p_secret);
  if exists (select 1 from public.profiles where lower(username) = lower(p_username)
             and id is distinct from pid) then
    raise exception 'username_taken';
  end if;

  if pid is null then
    ih := private.request_ip_hash();
    -- one lock per bucket (and one for the site-wide ceiling) for the rest of this transaction
    perform pg_advisory_xact_lock(hashtextextended('taw-lb-claim-site', 0));
    if ih is not null then
      perform pg_advisory_xact_lock(hashtextextended(encode(ih, 'hex'), 0));
    end if;
    delete from private.claim_log where at < now() - interval '2 days';
    if (select count(*) from private.claim_log where kind = 'create' and at > now() - interval '1 hour') >= 600 then
      raise exception 'rate_limited';
    end if;
    if ih is not null and (
         (select count(*) from private.claim_log where ip_hash = ih and kind = 'create' and at > now() - interval '1 hour') >= 20
      or (select count(*) from private.claim_log where ip_hash = ih and kind = 'create' and at > now() - interval '1 day') >= 60) then
      raise exception 'rate_limited';
    end if;
    begin
      insert into public.profiles (username) values (p_username) returning * into row;
    exception when unique_violation then
      raise exception 'username_taken'; -- lost a same-name race to another claimer
    end;
    insert into private.profile_secrets (profile_id, secret_hash) values (row.id, extensions.digest(p_secret, 'sha256'));
    insert into private.claim_log (ip_hash, kind) values (ih, 'create');
    return row;
  end if;

  -- rename: lock the row so two parallel renames can't both pass the cooldown
  select username, name_changed_at, created_at into cur, changed, born
    from public.profiles where id = pid for update;
  if cur = p_username then
    select * into row from public.profiles where id = pid; -- same name: no-op
    return row;
  end if;
  if born < now() - interval '10 minutes' and changed is not null and changed > now() - interval '1 day' then
    raise exception 'rename_cooldown';
  end if;
  begin
    update public.profiles
       set username = p_username,
           -- a typo fix in the first 10 minutes doesn't spend the daily rename
           name_changed_at = case when born >= now() - interval '10 minutes' then name_changed_at else now() end,
           updated_at = now()
     where id = pid returning * into row;
  exception when unique_violation then
    raise exception 'username_taken';
  end;
  insert into private.claim_log (ip_hash, kind) values (private.request_ip_hash(), 'rename');
  return row;
end $$;

create or replace function public.lb_submit(p_secret text, p_level integer, p_rebirths integer,
                                            p_lifetime_words bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  if old.submitted_at is not null and old.submitted_at >= now() - interval '5 seconds' then
    return; -- throttled
  end if;
  lv := greatest(1, least(coalesce(p_level, 1), 100000));
  rb := greatest(0, least(coalesce(p_rebirths, 0), 1000));
  w := greatest(0, least(coalesce(p_lifetime_words, 0), 100000000));
  -- honest-play shape (after the first push): nothing the ranking counts goes backwards, and words
  -- can't outrun a human typist. A push that breaks it is ignored.
  if old.submitted_at is not null then
    if rb < old.rebirths or w < old.lifetime_words then return; end if;
    if lv < old.level and rb = old.rebirths then return; end if;
    if w - old.lifetime_words > 20 * greatest(1, extract(epoch from (now() - old.submitted_at))) then return; end if;
  end if;
  update public.profiles
     set level = lv,
         rebirths = rb,
         lifetime_words = w,
         wins_per_word = greatest(0, least(round(coalesce(p_wins_per_word, 0), 1), 1000000000)),
         submitted_at = now(),
         updated_at = now()
   where id = pid;
end $$;

revoke all on function public.lb_claim(text, text) from public;
grant execute on function public.lb_claim(text, text) to anon, authenticated;
revoke all on function public.lb_submit(text, integer, integer, bigint, numeric) from public;
grant execute on function public.lb_submit(text, integer, integer, bigint, numeric) to anon, authenticated;
