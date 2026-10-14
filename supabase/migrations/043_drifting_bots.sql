-- 043_drifting_bots.sql - the 041 board bots DRIFT. Needs 041 (profiles.is_bot).
-- Nothing is written: public.leaderboard_s2 computes each bot's level / rebirths from the clock, so the
-- profiles row never changes and THIS WEEK + its gem prizes never see a bot move. No cron job needed.
-- Each bot: own pace (2-7 levels a day), rest days, rebirths at the real gate (LV 15 + 18 x R),
-- a goal (1-4 rebirths more, never above R7), and it stops playing 14-74 days after 2026-10-14.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run.
-- UNDO: re-run 028_season2_board_keep_place.sql

create or replace function public.lb_bot_drift(bot uuid, base_level int, base_rb int, out level int, out rebirths int)
language plpgsql stable
set search_path = ''
as $fn$
declare
  anchor date := date '2026-10-14';
  today date := (now() at time zone 'America/New_York')::date;
  hour_frac numeric := extract(epoch from ((now() at time zone 'America/New_York') - today::timestamp)) / 86400.0;
  pace numeric := 2 + abs(hashtext(bot::text || ':pace')) % 6;
  hesitate int := 2 + abs(hashtext(bot::text || ':wait')) % 10;
  goal int := least(7, base_rb + 1 + abs(hashtext(bot::text || ':goal')) % 4);
  park int := 1 + abs(hashtext(bot::text || ':park')) % 25;
  active int := 14 + abs(hashtext(bot::text || ':quit')) % 61;
  lv numeric := base_level;
  rb int := base_rb;
  d date;
  mood int;
  gain numeric;
  gate numeric;
begin
  d := anchor;
  while d <= today and d < anchor + active loop
    mood := abs(hashtext(bot::text || ':' || d::text)) % 4;
    gain := pace * (case mood when 0 then 0 when 1 then 0.5 when 2 then 1 else 1.5 end);
    if d = today then gain := gain * hour_frac; end if;
    lv := lv + gain;
    loop
      gate := 15 + 18 * rb + hesitate;
      if rb = base_rb then gate := greatest(gate, base_level + hesitate); end if;
      exit when rb >= goal or lv < gate;
      rb := rb + 1;
    end loop;
    d := d + 1;
  end loop;
  if rb >= goal then lv := least(lv, 15 + 18 * rb - park); end if;
  level := greatest(base_level, floor(lv)::int);
  rebirths := greatest(base_rb, rb);
end
$fn$;

-- in PUBLIC on purpose: the board's readers call it through the view, and it is pure arithmetic on numbers the
-- board already shows (the private schema stays locked, as 001 set it)
grant execute on function public.lb_bot_drift(uuid, int, int) to anon, authenticated;

drop view if exists public.leaderboard_s2;
create view public.leaderboard_s2 with (security_invoker = false) as
  with s1 as (
    select s.profile_id,
           row_number() over (order by s.rebirths desc, s.level desc, s.lifetime_words desc, p.created_at asc) as s1_rank
      from public.season1_snapshot s
      join public.profiles p on p.id = s.profile_id
  ),
  b as (
    select p.id, p.username, p.lifetime_words, p.lifetime_letters, p.wins_per_word, p.econ, p.stars, p.created_at,
           case when p.is_bot then d.level else p.level end as level,
           case when p.is_bot then d.rebirths else p.rebirths end as rebirths
      from public.profiles p
      left join lateral public.lb_bot_drift(p.id, p.level, p.rebirths) d on p.is_bot
     where p.econ = 13
  )
  select row_number() over (order by b.stars desc, b.rebirths desc, b.level desc, b.lifetime_words desc,
                                     s1.s1_rank asc nulls last, b.created_at asc) as rank,
         b.id, b.username, b.level, b.rebirths, b.lifetime_words, b.lifetime_letters, b.wins_per_word, b.econ, b.stars,
         (b.rebirths > 0 or b.level > 1 or b.lifetime_words > 0 or b.stars > 0) as earned,
         s1.s1_rank
    from b
    left join s1 on s1.profile_id = b.id;

grant select on public.leaderboard_s2 to anon, authenticated;

-- an earlier attempt of this file may have left a private copy behind
drop function if exists private.lb_bot_drift(uuid, int, int);

-- CHECK (the bots, as the board sees them):
-- select b.rank, b.username, b.level, b.rebirths from public.leaderboard_s2 b join public.profiles p on p.id = b.id where p.is_bot order by b.rank;
