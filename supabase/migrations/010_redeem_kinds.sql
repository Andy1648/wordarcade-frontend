-- 010_redeem_kinds.sql — R10 (Andy oct2): SCALING + BOOST redeem codes.
-- (Andy's note called this 008; 008 is 008_claim_cjk.sql and 009 records the words-board view.)
-- SAFE TO RE-RUN. Andy runs it: Supabase → SQL Editor → paste → Run. Claude never runs migrations.
--
-- New columns on public.redeem_codes:
--   kind        'wins' (default — today's code) | 'boost' (a timed ×boost_mult on EVERY mode)
--   per_level   wins codes only. K2 (Andy oct2 ~22:15, client-side — no SQL change): the `wins` column
--               is then a NUMBER OF WORDS, paid at the player's live rate when redeemed (like
--               achievements), so a code is always worth the same few minutes of play and never goes
--               dead. (R10 paid wins × level, which went invisible late in a run.)
--   boost_mult  boost codes: the multiplier (default 3)
--   boost_min   boost codes: minutes (default 10)
-- lb_redeem returns them. A client from before this migration ignores them; a client from after it
-- treats a response WITHOUT them as a plain wins code — so either order of deploy is safe.
--
-- HOW ANDY MAKES ONE (Table Editor → redeem_codes → Insert row):
--   scaling:  code LEVELUP, wins 30, per_level true              → pays 30 words at your rate
--   boost:    code TRIPLE,  kind boost, boost_mult 3, boost_min 10 → ×3 on everything for 10 min

alter table public.redeem_codes add column if not exists kind text not null default 'wins';
alter table public.redeem_codes add column if not exists per_level boolean not null default false;
alter table public.redeem_codes add column if not exists boost_mult integer not null default 3;
alter table public.redeem_codes add column if not exists boost_min integer not null default 10;
do $$ begin
  alter table public.redeem_codes add constraint redeem_codes_kind_check check (kind in ('wins', 'boost'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.redeem_codes add constraint redeem_codes_boost_check check (boost_mult >= 1 and boost_min >= 1);
exception when duplicate_object then null; end $$;

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
  return json_build_object('code', c, 'wins', r.wins, 'label', coalesce(r.label, c),
                           'kind', r.kind, 'per_level', r.per_level, 'boost_mult', r.boost_mult, 'boost_min', r.boost_min);
end $$;

revoke all on function public.lb_redeem(text, text) from public;
grant execute on function public.lb_redeem(text, text) to anon, authenticated;
