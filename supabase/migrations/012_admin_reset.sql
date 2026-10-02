-- 012_admin_reset.sql — Andy oct2: ADMIN FULL RESET by username. Progress lives in the browser's
-- localStorage and the cloud save keeps one snapshot, so a reset has to be OBEYED by the client:
--
--   update profiles set reset_all = true where username = 'NAME';
--
-- The next time that player's browser opens the menu, lb_load reports reset_all = true; the client
-- wipes every taw.* progress key (exactly like Stats → RESET ALL PROGRESS) but KEEPS the claimed name
-- and the device secret, then calls lb_reset_ack with the fresh save. lb_reset_ack (secret-checked,
-- like lb_save) does the three writes the normal paths refuse because they never go DOWN, in one
-- transaction, and only while the flag is set:
--   * the cloud save is overwritten with the fresh one (lb_save would answer 'lower');
--   * the board row is reset to LV 1 / 0 rebirths / 0 words / 0 letters (lb_submit2 would ignore it);
--   * the flag is cleared — so the reset happens once, and a reload does not repeat it.
-- If the ack never lands (offline), the flag stays and the next boot repeats the (idempotent) wipe.
-- ADDITIVE and re-runnable. Andy runs it in the Supabase SQL Editor.

alter table public.profiles add column if not exists reset_all boolean not null default false;

-- lb_load: unchanged, plus reset_all.
create or replace function public.lb_load(p_secret text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.cloud_saves; uname text; rst boolean;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select username, reset_all into uname, rst from public.profiles where id = pid;
  select * into s from private.cloud_saves where profile_id = pid;
  if not found then
    return json_build_object('id', pid, 'username', uname, 'blob', null, 'score', 0, 'reset_all', coalesce(rst, false));
  end if;
  return json_build_object('id', pid, 'username', uname, 'blob', s.blob, 'score', s.score, 'saved_at', s.saved_at,
                           'reset_all', coalesce(rst, false));
end $$;

-- The client obeyed: store its fresh save (lower is fine, ONCE), zero the board row, clear the flag.
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
         reset_all = false, submitted_at = now(), updated_at = now()
   where id = pid;
  return json_build_object('reset', true);
end $$;

revoke all on function public.lb_load(text) from public;
revoke all on function public.lb_reset_ack(text, text, numeric) from public;
grant execute on function public.lb_load(text) to anon, authenticated;
grant execute on function public.lb_reset_ack(text, text, numeric) to anon, authenticated;
