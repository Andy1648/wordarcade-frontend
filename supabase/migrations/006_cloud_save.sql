-- 006_cloud_save.sql — STEP 52 (Andy oct2): "A friend's progress reset. Back up progress to Supabase
-- tied to the claimed username's device secret; restore automatically when local data is missing and
-- on a new device via a one-time recovery code shown at claim time. Never let a restore lower
-- progress."
--
-- One row per claimed profile, in the PRIVATE schema (PostgREST never exposes it). Writes and reads
-- go through SECURITY DEFINER functions that prove the caller holds the profile's secret — the same
-- model as lb_submit. The blob is the game's own validated save export (src/save/saveBackup.js),
-- capped at 64 KB. `score` is the client's progress score (rebirths, level, lifetime letters, ...);
-- a save with a LOWER score than the stored one is ignored, so a wiped browser that starts again at
-- LV 1 can never overwrite the real save. ADDITIVE and re-runnable.

create table if not exists private.cloud_saves (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  blob text not null check (length(blob) <= 65536),
  score numeric(30, 0) not null default 0,
  saved_at timestamptz not null default now()
);
revoke all on private.cloud_saves from public, anon, authenticated;

create or replace function public.lb_save(p_secret text, p_blob text, p_score numeric)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old private.cloud_saves;
begin
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

create or replace function public.lb_load(p_secret text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; s private.cloud_saves; uname text;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select username into uname from public.profiles where id = pid;
  select * into s from private.cloud_saves where profile_id = pid;
  if not found then return json_build_object('id', pid, 'username', uname, 'blob', null, 'score', 0); end if;
  return json_build_object('id', pid, 'username', uname, 'blob', s.blob, 'score', s.score, 'saved_at', s.saved_at);
end $$;

revoke all on function public.lb_save(text, text, numeric) from public;
revoke all on function public.lb_load(text) from public;
grant execute on function public.lb_save(text, text, numeric) to anon, authenticated;
grant execute on function public.lb_load(text) to anon, authenticated;

create or replace function public.lb_caps()
returns json language sql stable as $$ select json_build_object('letters', true, 'cjk', true, 'cloud', true) $$;
grant execute on function public.lb_caps() to anon, authenticated;
