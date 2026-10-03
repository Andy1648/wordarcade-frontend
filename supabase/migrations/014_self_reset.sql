-- 014_self_reset.sql — N2 (Andy oct2): Stats → RESET ALL PROGRESS also resets the player's BOARD ROW and
-- CLOUD SAVE. Before this, the reset wiped only the browser — and the device secret with it — so the
-- board row was orphaned at its old level forever (Andy's own reset left NoBuffCookies at LV5222).
--
-- It reuses the ADMIN reset path from 012 exactly: lb_self_reset raises the player's OWN reset_all flag
-- (secret-checked, so a player can only ever reset themselves) and then runs lb_reset_ack, which in one
-- transaction overwrites the cloud save with the fresh one, zeroes the board row and clears the flag.
-- lb_reset_ack is redefined here to also zero the weekly counter that 013 added after 012.
--
-- ADDITIVE and re-runnable. Run AFTER 012 and 013. Andy runs it in the Supabase SQL Editor.
-- Without it the client feature-detects (the RPC 404s) and falls back to today's local-only reset.

create or replace function public.lb_reset_ack(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; rst boolean;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > 65536 then raise exception 'bad_blob'; end if;
  select reset_all into rst from public.profiles where id = pid for update;
  if not coalesce(rst, false) then return json_build_object('reset', false, 'reason', 'not_flagged'); end if;
  insert into private.cloud_saves as c (profile_id, blob, score, saved_at)
       values (pid, p_blob, greatest(0, coalesce(p_score, 0)), now())
  on conflict (profile_id) do update set blob = excluded.blob, score = excluded.score, saved_at = excluded.saved_at;
  update public.profiles
     set level = 1, rebirths = 0, lifetime_words = 0, lifetime_letters = 0, wins_per_word = 0,
         week_words = 0, week_key = null,
         reset_all = false, submitted_at = now(), updated_at = now()
   where id = pid;
  return json_build_object('reset', true);
end $$;

-- The player's own reset: flag yourself, then the admin path above does the rest.
create or replace function public.lb_self_reset(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  update public.profiles set reset_all = true where id = pid;
  return public.lb_reset_ack(p_secret, p_blob, p_score);
end $$;

revoke all on function public.lb_reset_ack(text, text, numeric) from public;
revoke all on function public.lb_self_reset(text, text, numeric) from public;
grant execute on function public.lb_reset_ack(text, text, numeric) to anon, authenticated;
grant execute on function public.lb_self_reset(text, text, numeric) to anon, authenticated;
