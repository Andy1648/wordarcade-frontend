-- 001_leaderboard.sql — STEP 24: username-only leaderboard (Andy A13: no Google sign-in, username
-- only, block bad names).
--
-- IDENTITY WITHOUT AUTH. Supabase anonymous sign-ins are disabled on this project, and the game has no
-- accounts. Each browser generates a random 32+ char SECRET (localStorage `taw.lb.secret`); the DB keeps
-- only its SHA-256 in private.profile_secrets, a schema PostgREST never exposes. The public table is
-- READ-ONLY to the anon key (RLS: select for all, no write policies, write grants revoked). Every write
-- goes through a SECURITY DEFINER function that first proves the caller holds the row's secret, so an
-- anonymous user can only ever write their OWN row.
--
-- NAMES. 3-16 chars of [A-Za-z0-9_], unique case-insensitively (unique index on lower(username)), and
-- clean: a BEFORE INSERT/UPDATE trigger runs public.username_is_clean(), the DB half of the client's
-- src/leaderboard/nameFilter.js. Both normalise identically (lowercase, leetspeak map, strip non-
-- letters, collapse runs) and check (a) whole-name matches against the full blocklist and (b) a short
-- list of unambiguous ROOTS anywhere in the name ("xXfuckerXx"). Moderation beyond that = Andy edits
-- or deletes rows in the Supabase Table Editor.

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---- the name filter ---------------------------------------------------------------------------
create table if not exists private.blocked_terms (
  term text primary key,
  kind text not null check (kind in ('exact', 'root'))
);

-- name_leet: lowercase, leetspeak map (0→o 1→i 3→e 4→a 5→s 7→t 8→b @→a $→s !→i 9→g), letters only.
create or replace function public.name_leet(t text)
returns text language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(t, '')), '0134578@$!9', 'oieastbasig'), '[^a-z]', '', 'g')
$$;
-- name_squash: name_leet with letter runs collapsed ("fuuuuck" → "fuck"). Used for ROOTS only: on
-- whole-name matches it would collide innocent names with blocked ones ("bobs" vs a squashed "boobs").
create or replace function public.name_squash(t text)
returns text language sql immutable as $$
  select regexp_replace(public.name_leet(t), '(.)\1+', '\1', 'g')
$$;

-- Clean iff (a) the name, letters-only or leet-decoded, is not a blocked term, and (b) no ROOT occurs
-- anywhere in its leet-decoded or squashed form. Mirrors src/leaderboard/nameFilter.js exactly.
create or replace function public.username_is_clean(u text)
returns boolean language sql stable security definer set search_path = private, public, pg_temp as $$
  select not exists (
    select 1 from private.blocked_terms b
    where (b.kind = 'exact' and (b.term = public.name_leet(u)
                                 or b.term = regexp_replace(lower(coalesce(u, '')), '[^a-z]', '', 'g')))
       or (b.kind = 'root' and (position(b.term in public.name_leet(u)) > 0
                                or position(b.term in public.name_squash(u)) > 0))
  )
$$;

-- ---- profiles ----------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  level integer not null default 1 check (level between 1 and 100000),
  rebirths integer not null default 0 check (rebirths between 0 and 1000),
  lifetime_words bigint not null default 0 check (lifetime_words between 0 and 100000000),
  wins_per_word numeric(14, 1) not null default 0 check (wins_per_word between 0 and 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_shape check (username ~ '^[A-Za-z0-9_]{3,16}$')
);
create unique index if not exists profiles_username_ci on public.profiles (lower(username));
create index if not exists profiles_rank_idx on public.profiles (rebirths desc, level desc, lifetime_words desc);

create or replace function private.profiles_name_guard()
returns trigger language plpgsql as $$
begin
  if not public.username_is_clean(new.username) then
    raise exception 'username_blocked' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists profiles_name_guard on public.profiles;
create trigger profiles_name_guard before insert or update of username on public.profiles
  for each row execute function private.profiles_name_guard();

create table if not exists private.profile_secrets (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  secret_hash bytea not null unique
);

-- RLS: everyone reads, nobody writes directly.
alter table public.profiles enable row level security;
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_all on public.profiles for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;

-- ---- writes: only through these, only with your secret ------------------------------------------
create or replace function private.profile_for_secret(p_secret text)
returns uuid language sql stable as $$
  select profile_id from private.profile_secrets
  where secret_hash = extensions.digest(p_secret, 'sha256')
$$;

-- Claim (first call) or rename (later calls) the caller's row. Returns the row.
create or replace function public.lb_claim(p_secret text, p_username text)
returns public.profiles language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; row public.profiles;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'bad_secret' using errcode = 'invalid_parameter_value';
  end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then
    raise exception 'username_shape' using errcode = 'check_violation';
  end if;
  if not public.username_is_clean(p_username) then
    raise exception 'username_blocked' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(p_username)
             and id is distinct from private.profile_for_secret(p_secret)) then
    raise exception 'username_taken' using errcode = 'unique_violation';
  end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then
    insert into public.profiles (username) values (p_username) returning * into row;
    insert into private.profile_secrets (profile_id, secret_hash) values (row.id, extensions.digest(p_secret, 'sha256'));
  else
    update public.profiles set username = p_username, updated_at = now() where id = pid returning * into row;
  end if;
  return row;
end $$;

-- Push the caller's current stats. Silently ignored more often than once per 5 s per row.
create or replace function public.lb_submit(p_secret text, p_level integer, p_rebirths integer,
                                            p_lifetime_words bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile' using errcode = 'no_data_found'; end if;
  update public.profiles
     set level = greatest(1, least(p_level, 100000)),
         rebirths = greatest(0, least(p_rebirths, 1000)),
         lifetime_words = greatest(0, least(p_lifetime_words, 100000000)),
         wins_per_word = greatest(0, least(round(p_wins_per_word, 1), 1000000000)),
         updated_at = now()
   where id = pid and updated_at < now() - interval '5 seconds';
end $$;

-- Is a name free + clean? (the claim form's live check — no secret needed, reveals nothing else)
create or replace function public.lb_name_status(p_username text)
returns text language sql stable security definer set search_path = public, private, pg_temp as $$
  select case
    when p_username is null or p_username !~ '^[A-Za-z0-9_]{3,16}$' then 'shape'
    when not public.username_is_clean(p_username) then 'blocked'
    when exists (select 1 from public.profiles where lower(username) = lower(p_username)) then 'taken'
    else 'ok' end
$$;

-- The board: rank by rebirths, then level, then lifetime words (ties broken by who got there first).
-- BOARD = LEVEL ONLY (Andy oct2 evening: "idc abt rebirth"; he ran this view on prod): level desc,
-- lifetime_words desc, created_at asc. Every migration that (re)builds public.leaderboard carries it, so a
-- re-run of any one of them can never put rebirths (or letters) back into the ranking.
create or replace view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by level desc, lifetime_words desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, wins_per_word
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;

revoke all on function public.lb_claim(text, text) from public;
revoke all on function public.lb_submit(text, integer, integer, bigint, numeric) from public;
grant execute on function public.lb_claim(text, text) to anon, authenticated;
grant execute on function public.lb_submit(text, integer, integer, bigint, numeric) to anon, authenticated;
grant execute on function public.lb_name_status(text) to anon, authenticated;
grant execute on function public.name_leet(text) to anon, authenticated;
grant execute on function public.name_squash(text) to anon, authenticated;
revoke execute on function public.username_is_clean(text) from public;
grant execute on function public.username_is_clean(text) to anon, authenticated;
