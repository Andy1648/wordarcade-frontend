-- 030_redeem_gems_overdrive.sql — Andy oct10: "codes for different cases (overdrive, gems, etc.)".
-- SAFE TO RE-RUN. Andy runs it: Supabase → SQL Editor → paste → Run. Claude never runs migrations.
--
-- Two new code kinds on public.redeem_codes (on top of 010's 'wins' / 'boost'):
--   gems       pays `gems` gems at once (the client's one gem door, reason 'code')
--   overdrive  starts OVERDRIVE — the ×10 on XP + wins — for `boost_min` minutes (a live one is extended)
-- New column: gems (0–100,000). lb_redeem returns it. A client from before this migration treats an unknown kind as
-- a plain wins code paying `wins` (0 for these) — harmless; deploy the client first.
--
-- HOW ANDY MAKES ONE (Table Editor → redeem_codes → Insert row):
--   gems:      code GEMRAIN,   kind gems,      gems 150
--   overdrive: code OVERDRIVE, kind overdrive, boost_min 5
-- Every code still has expires_at / max_uses / active, and one redeem per player.

alter table public.redeem_codes add column if not exists gems integer not null default 0;
do $$ begin
  alter table public.redeem_codes add constraint redeem_codes_gems_check check (gems >= 0 and gems <= 100000);
exception when duplicate_object then null; end $$;
alter table public.redeem_codes drop constraint if exists redeem_codes_kind_check;
alter table public.redeem_codes add constraint redeem_codes_kind_check check (kind in ('wins', 'boost', 'gems', 'overdrive'));

create or replace function public.lb_redeem(p_secret text, p_code text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare who bytea; pid uuid; c text; r public.redeem_codes;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  who := case when pid is not null then extensions.digest('taw-rc:p:' || pid::text, 'sha256')
              else extensions.digest('taw-rc:s:' || p_secret, 'sha256') end;
  delete from private.redeem_attempts where at < now() - interval '1 hour';
  if (select count(*) from private.redeem_attempts where player = who) >= 12 then raise exception 'rate_limited'; end if;
  insert into private.redeem_attempts (player) values (who);

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
  return json_build_object('code', c, 'wins', r.wins, 'label', coalesce(r.label, c),
                           'kind', r.kind, 'per_level', r.per_level, 'boost_mult', r.boost_mult, 'boost_min', r.boost_min,
                           'gems', r.gems);
end $$;

revoke all on function public.lb_redeem(text, text) from public;
grant execute on function public.lb_redeem(text, text) to anon, authenticated;

-- STARTER CODES (edit / switch off in the Table Editor; re-running never overwrites an existing row)
insert into public.redeem_codes (code, kind, gems, boost_mult, boost_min, label, max_uses) values
  ('OVERDRIVE',  'overdrive', 0,   10, 5,  'OVERDRIVE',       null),
  ('POWERSURGE', 'overdrive', 0,   10, 15, 'POWER SURGE',     100),
  ('GEMRAIN',    'gems',      150, 3,  10, 'GEM RAIN',        null),
  ('GEARUP',     'gems',      300, 3,  10, 'GEAR UP',         500),
  ('TYPEAWORD',  'gems',      75,  3,  10, 'ONE FREE ROLL',   null),
  ('DOUBLEUP',   'boost',     0,   2,  30, 'DOUBLE UP',       null)
on conflict (code) do nothing;
