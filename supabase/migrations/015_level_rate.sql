-- 015_level_rate.sql — ANTI-CHEAT (Andy oct3 10:29, R6): lb_submit2 rate-checked words (20/s) and letters
-- (150/s) but never LEVEL, which is how a row went LV102 → LV5222 in an hour with no new words. This
-- redefines lb_submit2 exactly as 013 left it (weekly counter included) plus a LEVEL clamp:
--
--   * a level rise is CLAMPED, not rejected — the rest of the submit (words, letters, weekly count) still
--     lands, and an honest row that was clamped catches up over its next submits;
--   * the rise allowed per accepted submit = 0.5 level a second since the last accepted submit, with that
--     allowance banking up to 20 minutes (600 levels). So the board climbs at most 1,800 levels an hour, however
--     often a client submits, and a player back from a long break still lands their real progress at once.
--     (It is TIME, not letters: the client submits only on menu load / board open, and menu typing earns
--     levels without adding lifetime letters, so a letters rule would hold honest menu typists back.)
--   * a REBIRTH (rebirths went up) restarts the level at 1, so the clamp counts from 1 — and rebirths
--     themselves may rise by at most 1 per accepted submit;
--   * the first submit (the baseline, made at claim time) is unchanged — an existing player claims at
--     whatever level they already are.
--
-- Headroom vs honest play (claude/econ-oct2 sims, today's curve): the median player's LV1→400 takes 18 min
-- (~0.37 level/s, the fastest stretch of the whole curve); the 600-level bank covers any honest burst.
-- Under PV10 levels get slower, never faster, so the headroom only grows. A clamped honest row is never
-- wrong upward: it shows a lower level for a while and catches up on the next submits.
--
-- WRITE-ONLY: Claude never runs migrations. Andy: paste the whole file into the SQL Editor and Run.
-- Safe to re-run (create or replace). Rows already on the board are NOT changed by this file.
-- If you ever re-run 011 or 013 later, re-run THIS file after them (they define lb_submit2 without the clamp).

create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv integer; max_rise bigint;
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
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    if w - old.lifetime_words > 20 * secs then return; end if;
    if l - old.lifetime_letters > 150 * secs then return; end if;
    -- 015: rebirths rise at most 1 per accepted submit; a rebirth restarts the level count at 1
    rb := least(rb, old.rebirths + 1);
    base_lv := case when rb > old.rebirths then 1 else old.level end;
    -- 015: the level may rise by ≤ 0.5 a second since the last accepted submit, banking ≤ 20 min (600 levels)
    max_rise := greatest(1, floor(least(secs, 1200) * 0.5)::bigint);
    lv := least(lv::bigint, base_lv::bigint + max_rise)::integer;
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

-- The OLD lb_submit (001/004, no letters) is still callable by anon and has no level check either — a direct
-- RPC call would skip the clamp above. It now forwards to lb_submit2, passing the row's stored letters (so it
-- can never move letters), and gets the same throttle, rate checks and level clamp. The live client only calls
-- lb_submit when lb_caps has no `letters` (never, since 005), so nothing honest changes.
create or replace function public.lb_submit(p_secret text, p_level integer, p_rebirths integer,
                                            p_lifetime_words bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; cur bigint;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select coalesce(lifetime_letters, 0) into cur from public.profiles where id = pid;
  perform public.lb_submit2(p_secret, p_level, p_rebirths, p_lifetime_words, cur, p_wins_per_word);
end $$;
revoke all on function public.lb_submit(text, integer, integer, bigint, numeric) from public;
grant execute on function public.lb_submit(text, integer, integer, bigint, numeric) to anon, authenticated;
