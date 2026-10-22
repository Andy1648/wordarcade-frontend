-- 058_reset_wipes_everything.sql — RESET ACCOUNT resets EVERYTHING (Andy oct21: "ensure reset account resets everything
-- (including unlisted gear.....)").
--
-- WHY: the browser side already wipes every taw.* key (resetAll.js → client.selfReset), but the server reset
-- (lb_self_reset → lb_reset_ack, also the dev's admin reset) only zeroed the board row and replaced the cloud copy. Left
-- behind, per player:
--   * public.unlisted_finds — the UNLISTED finds + their serials (the board card kept showing them);
--   * private.gear_owned / roll_log / gear_refused + the profiles s2_roll_* / s2_since_* columns — server-side gear and
--     the PITY countdown (lb_pity hands it straight back to the fresh save);
--   * public.profile_showcase — the board card's gear / hero / bio / gears-found;
--   * public.rebirth_requests — the rebirth log (a later heal reads its peak);
--   * the weekly baselines (week_words, s2_week_*0) and the rebirth-words baseline (rb_words0).
-- WHAT CHANGES: lb_reset_ack (056's body: the 1 MB cloud cap) now clears all of the above for that player too.
-- KEPT on purpose: the name + device secret (a reset keeps your name), season2_grants (the one-time season-2 welcome gems
-- must not pay twice), redeem claims (a code can't be redeemed again), cheat flags and past weekly finals / prizes.
-- ORDER: after 056. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

create or replace function public.lb_reset_ack(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; rst boolean;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > 1048576 then raise exception 'bad_blob'; end if;
  select reset_all into rst from public.profiles where id = pid for update;
  if not coalesce(rst, false) then return json_build_object('reset', false, 'reason', 'not_flagged'); end if;
  insert into private.cloud_saves as c (profile_id, blob, score, saved_at)
       values (pid, p_blob, greatest(0, coalesce(p_score, 0)), now())
  on conflict (profile_id) do update set blob = excluded.blob, score = excluded.score, saved_at = excluded.saved_at;
  update public.profiles
     set level = 1, rebirths = 0, stars = 0, lifetime_words = 0, lifetime_letters = 0, wins_per_word = 0,
         week_words = 0, s2_week_stars0 = 0, s2_week_rb0 = 0, s2_week_lv0 = 1, rb_words0 = null,
         s2_roll_seq = 0, s2_rolls = 0, s2_since_epic = 0, s2_since_leg = 0, s2_roll_spent = 0,
         reset_all = false, submitted_at = now(), updated_at = now()
   where id = pid;
  -- 058: everything else that belongs to this player's progress
  delete from public.unlisted_finds where profile_id = pid;
  delete from private.gear_owned where profile_id = pid;
  delete from private.roll_log where profile_id = pid;
  delete from private.gear_refused where profile_id = pid;
  delete from public.profile_showcase where profile_id = pid;
  delete from public.rebirth_requests where profile_id = pid;
  return json_build_object('reset', true);
end $$;
revoke all on function public.lb_reset_ack(text, text, numeric) from public;
grant execute on function public.lb_reset_ack(text, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
