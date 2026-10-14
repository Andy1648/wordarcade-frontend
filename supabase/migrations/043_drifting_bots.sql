-- 043_drifting_bots.sql — the 041 board bots DRIFT (Andy oct14 "love the bots" + the drifting-bots idea).
--
-- HOW IT MOVES: nothing is written. The board view computes each bot's level / rebirths from the clock:
--   * every bot has its own pace (2–7 levels a day, from a hash of its id) and a daily mood (from a hash of id + day):
--     ~25% rest days (no gain), the rest ×0.5 / ×1 / ×1.5 — so bots overtake each other, stall, and catch up again.
--     Today's gain arrives hour by hour, so a bot can pass you while you watch.
--   * a bot rebirths once its level clears the real gate (LV 15 + 18 × R, v3/econ.js REBIRTH_GATE_*) plus its own
--     2–11 level "hesitation" — the same rule a player meets.
--   * EVERY BOT HAS A STORY, so they never pile up: a goal (1–4 rebirths above where it started, never above R7 — 041's
--     rule, the real top players stay on top), a level it parks at under its next gate, and a day it stops playing
--     (14–74 days in). Early on most of them climb; later the board settles with bots spread out, not a wall of R7s.
--   * starts from the 041 numbers on 2026-10-14 (the anchor); a bot already past its gate earns a few levels before it
--     rebirths — nobody sees a bot jump when this runs.
-- WHY A VIEW, NOT A CRON JOB: the profiles row never changes, so THIS WEEK (leaderboard_s2_weekly reads the row) and the
-- weekly gem prizes (034) never see a bot gain anything; no triggers / anti-cheat flags fire; no pg_cron needed.
-- Only public.leaderboard_s2 (the ALL TIME board + ranks) shows the drift.
-- SAME VIEW AS 028 otherwise (columns, order, earned, s1_rank) — the only change is level / rebirths for is_bot rows.
-- Needs 041 (profiles.is_bot). HOW: Supabase → SQL editor → paste this whole file → Run. Safe to re-run.
-- UNDO: re-run 028_season2_board_keep_place.sql (bots go back to their 041 numbers).

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_bot') then
    raise exception '043 needs 041_board_bots.sql — profiles.is_bot is missing';
  end if;
end $$;

create schema if not exists private;

create or replace function private.lb_bot_drift(bot uuid, base_level int, base_rb int, out level int, out rebirths int)
language plpgsql stable
set search_path = ''
as $$
declare
  anchor constant date := date '2026-10-14';
  today date := (now() at time zone 'America/New_York')::date;
  hour_frac numeric := extract(epoch from ((now() at time zone 'America/New_York') - today::timestamp)) / 86400.0;
  pace numeric := 2 + abs(hashtext(bot::text || ':pace')) % 6;        -- 2..7 levels a day
  hesitate int := 2 + abs(hashtext(bot::text || ':wait')) % 10;       -- 2..11 levels past the gate before rebirthing
  goal int := least(7, base_rb + 1 + abs(hashtext(bot::text || ':goal')) % 4);   -- this bot's last rebirth (1..4 more, ≤ R7)
  park int := 1 + abs(hashtext(bot::text || ':park')) % 25;            -- it parks 1..25 levels under its next gate
  active int := 14 + abs(hashtext(bot::text || ':quit')) % 61;         -- it stops playing after 14..74 days
  gate numeric;
  lv numeric := base_level;
  rb int := base_rb;
  d date;
  mood int;
  gain numeric;
begin
  if today >= anchor then
    d := anchor;
    while d <= today and d < anchor + active loop
      mood := abs(hashtext(bot::text || ':' || d::text)) % 4;           -- 0 rest · 1 ×0.5 · 2 ×1 · 3 ×1.5
      gain := pace * (case mood when 0 then 0 when 1 then 0.5 when 2 then 1 else 1.5 end);
      if d = today then gain := gain * hour_frac; end if;               -- today's levels arrive through the day
      lv := lv + gain;
      -- rebirth at the real gate (+ this bot's hesitation) until its goal. A bot already past its gate on the anchor
      -- day first earns `hesitate` more levels — nobody sees a bot jump the moment this runs.
      loop
        gate := 15 + 18 * rb + hesitate;
        if rb = base_rb then gate := greatest(gate, base_level + hesitate); end if;
        exit when rb >= goal or lv < gate;
        rb := rb + 1;
      end loop;
      d := d + 1;
    end loop;
  end if;
  if rb >= goal then lv := least(lv, 15 + 18 * rb - park); end if;     -- parked under its next gate
  level := greatest(base_level, floor(lv)::int);
  rebirths := greatest(base_rb, rb);
end $$;
revoke all on function private.lb_bot_drift(uuid, int, int) from public;
revoke all on function private.lb_bot_drift(uuid, int, int) from anon, authenticated;

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
      left join lateral private.lb_bot_drift(p.id, p.level, p.rebirths) d on p.is_bot
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

-- CHECK (run twice an hour apart — some bots move):
--   select b.rank, b.username, b.level, b.rebirths from public.leaderboard_s2 b join public.profiles p on p.id = b.id
--    where p.is_bot order by b.rank;
