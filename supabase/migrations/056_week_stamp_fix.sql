-- 056_week_stamp_fix.sql — yiping oct18: "it wouldn't let me rebirth cuz it said 160/177 … but I'm level 178 now".
--
-- WHY: 034's trigger private.lb_s2_week_stamp declared a variable named `wk`, and its snapshot insert says
-- `on conflict (wk, profile_id)` — `wk` is also a column of private.s2_week_final, so Postgres raised
-- 42702 "column reference wk is ambiguous". The branch only runs on a row's FIRST update of a new ET week, and the
-- error aborts that whole UPDATE: every board push (and lb_rebirth's level → 1) on a row last touched in an earlier
-- week FAILS, forever. yiping's row (last write Oct 10) was frozen at LV 160, so lb_rebirth kept answering 160/177.
-- At the next week rollover EVERY active row hits it.
--
-- FIX: the same body as 034, the variable renamed to cur_wk. Nothing else changes.
-- ORDER: after 034. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

create or replace function private.lb_s2_week_stamp()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare cur_wk date := (date_trunc('week', now() at time zone 'America/New_York'))::date;
begin
  if new.econ is distinct from 13 then return new; end if;
  if old.econ is distinct from 13 then
    -- the row's FIRST season-2 write: its own baseline (season-1 numbers are not season-2 gains)
    new.s2_week_key := cur_wk;
    new.s2_week_stars0 := coalesce(new.stars, 0);
    new.s2_week_rb0 := coalesce(new.rebirths, 0);
    new.s2_week_lv0 := greatest(1, coalesce(new.level, 1));
  elsif old.s2_week_key is distinct from cur_wk then
    -- 034: keep the week being left — its gains exactly as leaderboard_s2_weekly computed them
    if old.s2_week_key is not null then
      insert into private.s2_week_final (wk, profile_id, week_stars, week_rebirths, week_levels, week_words)
      values (
        old.s2_week_key, old.id,
        greatest(0, coalesce(old.stars, 0) - old.s2_week_stars0),
        case when coalesce(old.stars, 0) > old.s2_week_stars0 then old.rebirths
             else greatest(0, old.rebirths - old.s2_week_rb0) end,
        case when coalesce(old.stars, 0) = old.s2_week_stars0 and old.rebirths = old.s2_week_rb0
             then greatest(0, old.level - old.s2_week_lv0)
             else greatest(0, old.level - 1) end,
        case when old.week_key = old.s2_week_key then coalesce(old.week_words, 0) else 0 end
      )
      on conflict (wk, profile_id) do nothing;
    end if;
    -- the week's FIRST change: the baseline is where the row stood before it
    new.s2_week_key := cur_wk;
    new.s2_week_stars0 := coalesce(old.stars, 0);
    new.s2_week_rb0 := coalesce(old.rebirths, 0);
    new.s2_week_lv0 := greatest(1, coalesce(old.level, 1));
  end if;
  return new;
end $$;
revoke all on function private.lb_s2_week_stamp() from public;
revoke all on function private.lb_s2_week_stamp() from anon, authenticated;
-- the trigger itself (024/034) already points at this function by name — no re-create needed
