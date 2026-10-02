-- 007_redeem_codes.sql — STEP 61 (Andy oct2): "Redeem codes: a CODES entry in the shop; codes live
-- server-side in Supabase (expiry, one use per player); Andy creates them by adding rows in the
-- Table Editor."
--
-- HOW ANDY MAKES A CODE: Supabase → Table Editor → public.redeem_codes → Insert row:
--   code        LAUNCH2026        (A-Z, 0-9 and -, 3-32 chars; stored and matched UPPERCASE)
--   wins        50000             (what it pays; lands in the player's REWARDS inbox to claim)
--   label       LAUNCH GIFT       (optional — shown on the claim; defaults to the code)
--   expires_at  2026-12-31 23:59  (optional — empty = never)
--   max_uses    1000              (optional — empty = unlimited players)
--   active      true              (untick to switch a code off without deleting it)
-- `uses` counts itself. Each player (claimed profile, else device secret) can redeem a code once.
--
-- SECURITY: the table has RLS ON and NO policies, so the public anon key can neither list nor read
-- codes — guessing is the only way in, and lb_redeem allows 12 tries per player per hour.
-- ADDITIVE and re-runnable.

create table if not exists public.redeem_codes (
  code text primary key check (code ~ '^[A-Z0-9-]{3,32}$'),
  wins bigint not null default 0 check (wins >= 0 and wins <= 1000000000),
  label text check (label is null or length(label) <= 40),
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.redeem_codes enable row level security;
revoke all on public.redeem_codes from anon, authenticated;

create table if not exists private.redeem_claims (
  code text not null references public.redeem_codes (code) on delete cascade,
  player bytea not null,
  claimed_at timestamptz not null default now(),
  primary key (code, player)
);
create table if not exists private.redeem_attempts (
  player bytea not null,
  at timestamptz not null default now()
);
create index if not exists redeem_attempts_player_at on private.redeem_attempts (player, at);
revoke all on private.redeem_claims from public, anon, authenticated;
revoke all on private.redeem_attempts from public, anon, authenticated;

create or replace function public.lb_redeem(p_secret text, p_code text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare who bytea; pid uuid; c text; r public.redeem_codes;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  -- one player = the claimed profile when there is one (same on every device), else this device
  who := case when pid is not null then extensions.digest('taw-rc:p:' || pid::text, 'sha256')
              else extensions.digest('taw-rc:s:' || p_secret, 'sha256') end;
  delete from private.redeem_attempts where at < now() - interval '1 hour';
  if (select count(*) from private.redeem_attempts where player = who) >= 12 then raise exception 'rate_limited'; end if;
  insert into private.redeem_attempts (player) values (who);

  -- From here on a refusal is RETURNED, not raised: raising would roll back the attempt row above,
  -- and the rate limit would never see a wrong guess.
  c := upper(btrim(coalesce(p_code, '')));
  select * into r from public.redeem_codes where code = c for update;
  if not found or not r.active then return json_build_object('error', 'bad_code'); end if;
  if r.expires_at is not null and r.expires_at < now() then return json_build_object('error', 'expired'); end if;
  if r.max_uses is not null and r.uses >= r.max_uses then return json_build_object('error', 'used_up'); end if;
  if exists (select 1 from private.redeem_claims where code = c and player = who) then
    return json_build_object('error', 'already_redeemed');
  end if;
  insert into private.redeem_claims (code, player) values (c, who);
  update public.redeem_codes set uses = uses + 1 where code = c;
  return json_build_object('code', c, 'wins', r.wins, 'label', coalesce(r.label, c));
end $$;

revoke all on function public.lb_redeem(text, text) from public;
grant execute on function public.lb_redeem(text, text) to anon, authenticated;
