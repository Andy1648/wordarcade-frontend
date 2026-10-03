-- 016_econ_v10.sql — PROGRESSION v10 (claude/econ-oct2/v10-spec.md, adversarial review must-fix 3).
--
-- WHY: a stale tab / old cached bundle keeps farming the OLD level curve (LV400 in 18 min) and spreads it:
-- lb_save accepts an equal-or-higher score, a restore copies the blob to other devices, and lb_submit2
-- accepts the level. An `econ_version` argument added to the OLD functions would do nothing, because old
-- clients never send it. So the gate is the function SIGNATURE: the v10 client calls NEW functions that
-- take `p_econ integer` (must be 10), and the old write paths become no-ops.
--
--   * lb_submit3(…, p_econ)  = 015's lb_submit2 EXACTLY (throttle, monotone + rate checks, 015's level
--                              clamp, 013's weekly counter) + the p_econ = 10 check.
--   * lb_save2(…, p_econ)    = 006's lb_save + the p_econ = 10 check.
--   * lb_load2(p_secret, p_econ) = 012's lb_load (reset_all included) + the p_econ = 10 check.
--   * lb_submit2 / lb_submit / lb_save → NO-OPS (return without writing). An old bundle can no longer
--     move a board row or overwrite a cloud save. lb_load stays readable (restoring a v10 save into an
--     old bundle is harmless: it cannot write it back, and the v10 client ignores a stale level write).
--   * lb_caps gains econ: 10. The client feature-detects it and calls the new functions ONLY then, so the
--     v10 client works before this file is run (it keeps using the old functions until then).
--
-- ORDER (Andy): deploy the v10 client FIRST, then run this file. (Run before the deploy, every live client
-- is an "old bundle" and its submits/saves become no-ops until it reloads onto v10.)
-- WRITE-ONLY: Claude never runs migrations. Paste the whole file into the SQL Editor and Run.
-- Safe to re-run (create or replace). No row is changed by this file.
-- If 011, 013 or 015 is ever re-run later, re-run THIS file after them (they redefine the old functions as
-- writers again).

-- ---- lb_submit3: 015's lb_submit2 body, version-gated ------------------------------------------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv integer; max_rise bigint;
begin
  if p_econ is distinct from 10 then raise exception 'old_client'; end if;
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
  -- 013: first submit = baseline only; after that, the words typed since the last accepted submit
  delta := case when old.submitted_at is null then 0 else greatest(0, w - coalesce(old.lifetime_words, 0)) end;
  update public.profiles
     set level = lv, rebirths = rb, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) from public;
grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;

-- ---- lb_save2: 006's lb_save, version-gated ------------------------------------------------------------
create or replace function public.lb_save2(p_secret text, p_blob text, p_score numeric, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old private.cloud_saves;
begin
  if p_econ is distinct from 10 then return json_build_object('saved', false, 'reason', 'old_client'); end if;
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

-- ---- lb_load2: 012's lb_load, version-gated ------------------------------------------------------------
create or replace function public.lb_load2(p_secret text, p_econ integer)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.cloud_saves; uname text; rst boolean;
begin
  if p_econ is distinct from 10 then raise exception 'old_client'; end if;
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

-- ---- the OLD write paths become no-ops (same signatures, so old bundles get a clean success, not an error) --
create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  return; -- 016: pre-v10 bundles may not write the board (lb_submit3 is the v10 path)
end $$;
revoke all on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) from public;
grant execute on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) to anon, authenticated;

create or replace function public.lb_submit(p_secret text, p_level integer, p_rebirths integer,
                                            p_lifetime_words bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  return; -- 016: no-op (was forwarding to lb_submit2 since 015)
end $$;
revoke all on function public.lb_submit(text, integer, integer, bigint, numeric) from public;
grant execute on function public.lb_submit(text, integer, integer, bigint, numeric) to anon, authenticated;

create or replace function public.lb_save(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  return json_build_object('saved', false, 'reason', 'old_client'); -- 016: lb_save2 is the v10 path
end $$;
revoke all on function public.lb_save(text, text, numeric) from public;
grant execute on function public.lb_save(text, text, numeric) to anon, authenticated;

-- ---- feature detection: everything 013 reported, plus econ: 10 ----------------------------------------
create or replace function public.lb_caps()
returns json language sql stable as $$
  select json_build_object('letters', true, 'cjk', true, 'cloud', true, 'weekly', true, 'econ', 10)
$$;
grant execute on function public.lb_caps() to anon, authenticated;
