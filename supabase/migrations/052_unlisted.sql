-- 052_unlisted.sql - THE UNLISTED (Andy oct17 "people have been begging me for secret gear"). A gear tier you FIND, never
-- roll or buy (client src/unlisted/unlisted.js). This file gives each find its SERIAL: "#0042" = the 42nd player to find
-- that gear, in the order the finds reach the server. The serial is the brag, so the server hands it out - never the
-- browser.
--
--   public.unlisted_finds   one row per (gear, player): the serial + when. Readable by anyone (the leaderboard profile
--                           card shows a player's UNLISTED gears + serials); written ONLY by lb_unlisted_claim.
--   private.unlisted_pool   the gear ids the claim accepts, and whether each is still OPEN. A season gear is closed when
--                           its season ends and never re-opens:  update private.unlisted_pool set open = false
--                           where gear_id = 'mk-ul-tripledouble';
--   lb_unlisted_claim(secret, gear)  -> { ok, serial } (the same serial every time for the same player - idempotent),
--                           { error: 'no_profile' | 'unknown' | 'closed' | 'slow_down' }.
--
-- TRUST: a find is detected in the browser (the keys you type), so a determined devtools user can claim one. That is
-- the same trust the secrets' Wins always had; what it cannot do is take an EARLIER serial than a real finder already
-- holds, or pick its number. One claim per 2 s per player. Review: select * from public.unlisted_finds order by found_at;
--
-- gear_check (042) already shows any non-rolled gear id on the card, so a worn UNLISTED needs no change there.
-- ORDER: after 051. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.
-- ASCII only.

create table if not exists private.unlisted_pool (
  gear_id text primary key check (gear_id ~ '^mk-ul-[a-z0-9-]{1,20}$'),
  open boolean not null default true
);
revoke all on private.unlisted_pool from public;
revoke all on private.unlisted_pool from anon, authenticated;
insert into private.unlisted_pool (gear_id) values
  ('mk-ul-og'), ('mk-ul-wishbone'), ('mk-ul-typewriter'), ('mk-ul-mirror'), ('mk-ul-midas'), ('mk-ul-tripledouble')
on conflict (gear_id) do nothing;

create table if not exists public.unlisted_finds (
  gear_id text not null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  serial integer not null check (serial between 1 and 99999),
  found_at timestamptz not null default now(),
  primary key (gear_id, profile_id),
  unique (gear_id, serial)
);
create index if not exists unlisted_finds_profile on public.unlisted_finds (profile_id);
alter table public.unlisted_finds enable row level security;
drop policy if exists unlisted_finds_read on public.unlisted_finds;
create policy unlisted_finds_read on public.unlisted_finds for select to anon, authenticated using (true);
revoke insert, update, delete on public.unlisted_finds from anon, authenticated;

create or replace function public.lb_unlisted_claim(p_secret text, p_gear text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; is_open boolean; s integer; last timestamptz;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('error', 'no_profile'); end if;
  select open into is_open from private.unlisted_pool where gear_id = p_gear;
  if is_open is null then return json_build_object('error', 'unknown'); end if;
  -- already found: the same serial, always (a retry or a second device never takes a new number)
  select serial into s from public.unlisted_finds where gear_id = p_gear and profile_id = pid;
  if s is not null then return json_build_object('ok', true, 'serial', s, 'v', 52); end if;
  if not is_open then return json_build_object('error', 'closed'); end if;
  select max(found_at) into last from public.unlisted_finds where profile_id = pid;
  if last is not null and last > now() - interval '2 seconds' then return json_build_object('error', 'slow_down'); end if;
  -- one serial at a time per gear: the next number in arrival order
  perform pg_advisory_xact_lock(hashtext('unlisted:' || p_gear));
  select coalesce(max(serial), 0) + 1 into s from public.unlisted_finds where gear_id = p_gear;
  insert into public.unlisted_finds (gear_id, profile_id, serial) values (p_gear, pid, s);
  return json_build_object('ok', true, 'serial', s, 'v', 52);
end $$;
revoke all on function public.lb_unlisted_claim(text, text) from public;
grant execute on function public.lb_unlisted_claim(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
