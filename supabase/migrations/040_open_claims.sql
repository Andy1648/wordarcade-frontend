-- 040_open_claims.sql — EVERY VISITOR GETS A NAME (Andy oct13: "anyone who opens website autogenerates username …
-- no need for sign up bc that already too high barrier"). The client now claims a generated name (NEONGOBLIN42 style,
-- the same generator a quick-play join uses) for any browser that has typed a little and has no name yet
-- (leaderboard/autoName.js). That turns one claim per SIGN-UP into one claim per VISITOR, so 004's limits are raised:
--   site-wide   600 → 3,000 creates an hour
--   per IP       20 → 120 an hour, 60 → 400 a day   (a school / a café shares one IP — 20 would lock out a classroom)
-- Everything else is 008's lb_claim VERBATIM (shape incl. CJK, blocklist, taken, the rename cooldown — a renamed auto
-- name is the player's first rename, never on cooldown). ADDITIVE and re-runnable.
-- HOW: Supabase → SQL editor → paste this file → Run. Safe to run before or after the frontend merge: the old client
-- never auto-claims, so the higher limits change nothing until it ships; the new client with the OLD limits only gets
-- 'rate_limited' more often (the name is retried on a later visit — nothing breaks).

create or replace function public.lb_claim(p_secret text, p_username text)
returns public.profiles language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; row public.profiles; ih bytea; cur text; changed timestamptz; born timestamptz;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'bad_secret';
  end if;
  if p_username is null or not (p_username ~ '^[A-Za-z0-9_]{3,16}$'
       or (p_username ~ '^[A-Za-z0-9_㐀-䶿一-鿿]{2,12}$' and p_username ~ '[㐀-䶿一-鿿]')) then
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
    if (select count(*) from private.claim_log where kind = 'create' and at > now() - interval '1 hour') >= 3000 then
      raise exception 'rate_limited';
    end if;
    if ih is not null and (
         (select count(*) from private.claim_log where ip_hash = ih and kind = 'create' and at > now() - interval '1 hour') >= 120
      or (select count(*) from private.claim_log where ip_hash = ih and kind = 'create' and at > now() - interval '1 day') >= 400) then
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

revoke all on function public.lb_claim(text, text) from public;
grant execute on function public.lb_claim(text, text) to anon, authenticated;
