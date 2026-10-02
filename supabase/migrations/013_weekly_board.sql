-- 013_weekly_board.sql — BB3 (Andy oct2): a WEEKLY leaderboard that resets Monday 00:00 ET, server-side.
--
-- The all-time board ranks by rebirths → level (progress you keep), so the weekly board is a separate
-- race: WORDS TYPED THIS WEEK. Every accepted submit adds the words typed since the previous submit to
-- the profile's counter for the CURRENT week, where the week is the America/New_York calendar week
-- starting Monday 00:00 (Postgres date_trunc('week', …) weeks start on Monday). The reset is therefore
-- exact and needs no cron: at Monday 00:00 ET the current week key changes, every old counter falls out
-- of the view, and the first submit of the new week starts a fresh count.
--
-- Anti-cheat is unchanged (lb_submit2's monotone + per-second rate checks still gate every write).
-- A profile's FIRST submit sets the baseline and counts nothing (a long-time player claiming a name
-- must not dump a lifetime of words into one week). ADDITIVE and re-runnable. Andy runs it.

alter table public.profiles add column if not exists week_key date;
alter table public.profiles add column if not exists week_words bigint not null default 0;
do $$ begin
  alter table public.profiles add constraint profiles_week_words_nonneg check (week_words >= 0);
exception when duplicate_object then null; end $$;

-- The week key everywhere below: Monday 00:00 America/New_York of the current week, as a date —
--   (date_trunc('week', now() at time zone 'America/New_York'))::date
-- inlined (not a helper in the private schema, which anon must never be granted).

-- lb_submit2 (011) + the weekly counter. The checks are byte-identical to 011.
create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
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
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  -- first submit = baseline only; after that, the words typed since the last accepted submit
  delta := case when old.submitted_at is null then 0 else greatest(0, w - coalesce(old.lifetime_words, 0)) end;
  update public.profiles
     set level = lv, rebirths = rb, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) from public;
grant execute on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) to anon, authenticated;

-- THIS WEEK's board: only rows that typed this ET week. Most words first; then level; first-come.
drop view if exists public.leaderboard_weekly;
create view public.leaderboard_weekly with (security_invoker = true) as
  select row_number() over (order by week_words desc, level desc, created_at asc) as rank,
         id, username, level, rebirths, week_words
    from public.profiles
   where week_key = (date_trunc('week', now() at time zone 'America/New_York'))::date and week_words > 0;
grant select on public.leaderboard_weekly to anon, authenticated;

-- The client feature-detects the weekly board through lb_caps.
create or replace function public.lb_caps()
returns json language sql stable as $$ select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true) $$;
grant execute on function public.lb_caps() to anon, authenticated;
