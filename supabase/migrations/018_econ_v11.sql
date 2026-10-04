-- 018_econ_v11.sql — PROGRESSION v11 (claude/econ-oct2/v11-spec.md, review round 2 item 2).
--
-- WHY: 016 gated the board / cloud writes on p_econ = 10. The v11 client speaks econ 11, and a STALE v10 tab
-- (old cached bundle, power-scaled curve, game words still crediting XP) still sends 10 — so after this file
-- it must be refused like a pre-v10 bundle was in 016.
--
--   * lb_submit3(…, p_econ) — 017's version (private.lb_board_write: the reset rule + 015's level clamp +
--                             013's weekly counter), now gated on p_econ = 11; marks the row econ = 11.
--   * lb_save2(…, p_econ)   — 016's body, gated on p_econ = 11.
--   * lb_load2(p_secret, p_econ) — 016's body (reset_all included), gated on p_econ = 11.
--   * lb_caps reports econ: 11 (and board_econ: true, as 017).
--
-- WHICH VERSIONS ARE ACCEPTED: 11 ONLY. Accepting 10 would keep a stale v10 tab writing: its board level is
-- clamped and monotone (it cannot raise a row past the real one), but its CLOUD SAVE would still be stored
-- whenever its score is equal or higher, and a restore would copy a v10-era blob to other devices. Refusing
-- 10 is safe for v11 clients: they read lb_caps once per page load and send exactly what it reports
-- (cloudSave.js econRpcArg) — a v11 tab opened before this file ran sends 10 until its next reload, gets
-- 'old_client' on those calls (submits are retried every load; nothing is lost), and is fine after a reload.
--
-- Rows submitted on 10 keep their wins/word on the board: v11 did not change wins (the client treats
-- econ >= 10 as current).
--
-- DEPENDENCIES: 016 (lb_save2 / lb_load2 shape) and 017 (private.lb_board_write, profiles.econ, the views).
-- ORDER (Andy): deploy the v11 client FIRST (it works on 016 by sending 10), THEN run this file, then
-- `notify pgrst, 'reload schema';`. If 016 or 017 is ever re-run, re-run THIS file after it.
-- WRITE-ONLY: Claude never runs migrations. Safe to re-run (create or replace). No row is changed by this file.

-- ---- lb_submit3: 017's rule, gated on 11; marks the row econ = 11 ----------------------------------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if p_econ is distinct from 11 then raise exception 'old_client'; end if;
  perform private.lb_board_write(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters,
                                 p_wins_per_word, (11)::smallint); -- econ = 11
end $$;
revoke all on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) from public;
grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;

-- ---- lb_save2: 016's body, gated on 11 ---------------------------------------------------------------------
create or replace function public.lb_save2(p_secret text, p_blob text, p_score numeric, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old private.cloud_saves;
begin
  if p_econ is distinct from 11 then return json_build_object('saved', false, 'reason', 'old_client'); end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > 65536 then raise exception 'bad_blob'; end if;
  select * into old from private.cloud_saves where profile_id = pid for update;
  if found then
    if old.saved_at >= now() - interval '20 seconds' then return json_build_object('saved', false, 'reason', 'throttled'); end if;
    if coalesce(p_score, 0) < old.score then return json_build_object('saved', false, 'reason', 'lower'); end if;
    update private.cloud_saves set blob = p_blob, score = coalesce(p_score, 0), saved_at = now() where profile_id = pid;
  else
    insert into private.cloud_saves (profile_id, blob, score) values (pid, p_blob, coalesce(p_score, 0));
  end if;
  return json_build_object('saved', true);
end $$;
revoke all on function public.lb_save2(text, text, numeric, integer) from public;
grant execute on function public.lb_save2(text, text, numeric, integer) to anon, authenticated;

-- ---- lb_load2: 016's body, gated on 11 ---------------------------------------------------------------------
create or replace function public.lb_load2(p_secret text, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.cloud_saves; uname text; rst boolean;
begin
  if p_econ is distinct from 11 then raise exception 'old_client'; end if;
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
revoke all on function public.lb_load2(text, integer) from public;
grant execute on function public.lb_load2(text, integer) to anon, authenticated;

-- ---- feature detection: 017's caps, econ: 11 ---------------------------------------------------------------
create or replace function public.lb_caps()
returns json language sql stable as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'board_econ', true, 'econ', 11)
$$;
grant execute on function public.lb_caps() to anon, authenticated;
