-- 011_no_caps.sql — NO CAPS ON NUMBERS (Andy oct2, asked repeatedly).
-- (Andy's note called this 008; 008 = 008_claim_cjk.sql, 009 = the words-board view, 010 = redeem kinds.)
-- SAFE TO RE-RUN. Andy runs it: Supabase → SQL Editor → paste → Run. Claude never runs migrations.
--
-- What it removes (each was a ceiling a long-lived player would eventually hit and then sit on):
--   profiles.wins_per_word   numeric(14,1) + check <= 1e9      → plain numeric, check >= 0
--   profiles.level           check <= 100,000                   → check >= 1
--   profiles.rebirths        check <= 1,000                     → check >= 0
--   profiles.lifetime_words  check <= 1e8                       → check >= 0
--   profiles.lifetime_letters check <= 2e9                      → check >= 0
--   lb_submit2               least(..., 1e9 / 100000 / 1000 / 1e8 / 2e9) clamps → none (floors at 0 kept)
--   redeem_codes.wins        bigint + check <= 1e9              → plain numeric, check >= 0 (idempotent —
--                                                                 Andy already ran this part once)
--   private.cloud_saves.score numeric(30,0)                    → plain numeric (the client's progress
--                                                                 score now puts uncapped rebirths on top)
-- KEPT on purpose: the anti-cheat RATE limits in lb_submit2 (words/letters per second since the last
-- submit) and "progress never goes down" — those are not caps on a value, they stop a forged jump.

-- ---- profiles -------------------------------------------------------------------------------------
-- The view depends on the column type; drop and recreate it around the change (same definition as 009).
drop view if exists public.leaderboard;

alter table public.profiles drop constraint if exists profiles_wins_per_word_check;
alter table public.profiles alter column wins_per_word type numeric using wins_per_word::numeric;
do $$ begin
  alter table public.profiles add constraint profiles_wpw_nonneg check (wins_per_word >= 0);
exception when duplicate_object then null; end $$;

alter table public.profiles drop constraint if exists profiles_level_check;
do $$ begin
  alter table public.profiles add constraint profiles_level_min check (level >= 1);
exception when duplicate_object then null; end $$;

alter table public.profiles drop constraint if exists profiles_rebirths_check;
do $$ begin
  alter table public.profiles add constraint profiles_rebirths_nonneg check (rebirths >= 0);
exception when duplicate_object then null; end $$;

alter table public.profiles drop constraint if exists profiles_lifetime_words_check;
do $$ begin
  alter table public.profiles add constraint profiles_words_nonneg check (lifetime_words >= 0);
exception when duplicate_object then null; end $$;

alter table public.profiles drop constraint if exists profiles_letters_range;
do $$ begin
  alter table public.profiles add constraint profiles_letters_nonneg check (lifetime_letters >= 0);
exception when duplicate_object then null; end $$;

create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by lifetime_words desc, level desc, rebirths desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;

-- ---- the submit function: no least(...) ceilings -----------------------------------------------------
create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  if old.submitted_at is not null and old.submitted_at >= now() - interval '5 seconds' then
    return; -- throttled
  end if;
  lv := greatest(1, coalesce(p_level, 1));
  rb := greatest(0, coalesce(p_rebirths, 0));
  w := greatest(0, coalesce(p_lifetime_words, 0));
  l := greatest(0, coalesce(p_lifetime_letters, 0));
  if old.submitted_at is not null then
    if rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters then return; end if;
    if lv < old.level and rb = old.rebirths then return; end if;
    if w - old.lifetime_words > 20 * greatest(1, extract(epoch from (now() - old.submitted_at))) then return; end if;
    if l - old.lifetime_letters > 150 * greatest(1, extract(epoch from (now() - old.submitted_at))) then return; end if;
  end if;
  update public.profiles
     set level = lv, rebirths = rb, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) from public;
grant execute on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) to anon, authenticated;

-- ---- redeem codes ------------------------------------------------------------------------------------
alter table public.redeem_codes drop constraint if exists redeem_codes_wins_check;
alter table public.redeem_codes alter column wins type numeric using wins::numeric;
do $$ begin
  alter table public.redeem_codes add constraint redeem_codes_wins_nonneg check (wins >= 0);
exception when duplicate_object then null; end $$;

-- ---- cloud save score --------------------------------------------------------------------------------
alter table private.cloud_saves alter column score type numeric using score::numeric;
