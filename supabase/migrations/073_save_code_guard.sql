-- 073_save_code_guard.sql — A SHORT CODE NEVER SHRINKS (save-safety oct28: "ensure nothing messed up happens with save
-- code or whatever").
--
-- WHY: 071's lb_save_code_put REPLACES what an account's code holds on every call, and the client calls it the moment
-- SETTINGS (and now PROFILE / the WRITE DOWN YOUR CODE card) opens, so COPY can put the code on the clipboard inside the
-- tap. A device BEHIND the code (the second device of a shared account, a heavy save whose cloud copy is over the cap, a
-- wiped browser that kept only its secret cookie) overwrote the code with its own LOWER save the moment it opened
-- SETTINGS to paste it — and the code then loaded that lower save. PR #562 guards it on the client when the device knows
-- its code; this closes it for every device.
--
-- WHAT CHANGES:
--   * private.save_codes gains `score` — the save's progress score, the SAME ★-first number the client compares (cloud
--     restore, the load confirm): stars · 10^36 + rebirths · 10^24 + level · 10^12 + lifetime letters (src/save/
--     cloudSave.js progressScoreFromKeys, sent by src/save/saveCode.js issueShortCode as p_score).
--   * lb_save_code_put(p_secret, p_blob, p_score DEFAULT NULL) KEEPS the stored save when its score is higher than the
--     incoming one → { ok: true, code, kept: true, reason: 'lower' } (the code still comes back, so COPY still works).
--     Equal or higher replaces it, and the score only ever RISES (raise-only). A call without a score (a stale bundle)
--     counts as 0: it can fill an unscored row but never replace a scored one.
--   * RESET ACCOUNT (lb_reset_ack — the self reset and the admin reset both end there; it flips reset_all true → false)
--     clears the stored score, so the fresh save's next upload replaces the old one: a reset is a reset. The code itself
--     (the account's key) is kept.
--   * unchanged: one code per account, the 3-second double-tap rule, the 1 MB cap, the 600-new-codes-an-hour cap,
--     lb_save_code_get.
-- The client needs nothing from this file: it sends p_score and, while only 071's 2-argument function exists (PGRST202),
-- re-sends without it — today's behaviour.
-- ORDER: after 071. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

alter table private.save_codes add column if not exists score numeric;

-- 071's 2-argument function goes: the 3-argument one (p_score defaults to NULL) answers both kinds of call
drop function if exists public.lb_save_code_put(text, text);

create or replace function public.lb_save_code_put(p_secret text, p_blob text, p_score numeric default null)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; cur private.save_codes; c text; i integer; tries integer := 0; sc numeric;
        ALPHA constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- 31 symbols: no 0 O 1 I L
        MAX_BLOB constant integer := 1048576;
        NEW_PER_HOUR constant integer := 600;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > MAX_BLOB or left(p_blob, 5) <> 'TAW2.' then
    return json_build_object('ok', false, 'reason', 'bad_blob');
  end if;
  sc := greatest(0, coalesce(p_score, 0));
  select * into cur from private.save_codes where profile_id = pid for update;
  if found then
    if cur.updated_at > now() - interval '3 seconds' then
      return json_build_object('ok', true, 'code', cur.code, 'kept', true); -- a double tap: the copy a moment ago stands
    end if;
    -- 073: a code holding a save AHEAD of this one keeps it
    if cur.score is not null and sc < cur.score then
      return json_build_object('ok', true, 'code', cur.code, 'kept', true, 'reason', 'lower');
    end if;
    update private.save_codes set blob = p_blob, score = greatest(sc, coalesce(cur.score, 0)), updated_at = now()
     where profile_id = pid;
    return json_build_object('ok', true, 'code', cur.code);
  end if;
  if (select count(*) from private.save_codes where created_at > now() - interval '1 hour') >= NEW_PER_HOUR then
    return json_build_object('ok', false, 'reason', 'busy');
  end if;
  loop
    tries := tries + 1;
    c := '';
    for i in 1..10 loop
      c := c || substr(ALPHA, 1 + (get_byte(uuid_send(gen_random_uuid()), 0) % 31), 1);
    end loop;
    insert into private.save_codes (code, profile_id, blob, score) values (c, pid, p_blob, sc) on conflict do nothing;
    if found then return json_build_object('ok', true, 'code', c); end if;
    -- a collision on the code (or a racing first copy on the profile): the profile's row wins if it exists now
    select * into cur from private.save_codes where profile_id = pid for update;
    if found then
      if cur.score is not null and sc < cur.score then
        return json_build_object('ok', true, 'code', cur.code, 'kept', true, 'reason', 'lower');
      end if;
      update private.save_codes set blob = p_blob, score = greatest(sc, coalesce(cur.score, 0)), updated_at = now()
       where profile_id = pid;
      return json_build_object('ok', true, 'code', cur.code);
    end if;
    if tries >= 8 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  end loop;
end $$;
revoke all on function public.lb_save_code_put(text, text, numeric) from public;
grant execute on function public.lb_save_code_put(text, text, numeric) to anon, authenticated;

-- RESET ACCOUNT: the score goes with the reset (reset_all true → false is lb_reset_ack finishing), so the fresh save's
-- next upload replaces the old one. The row, and so the code, stays.
create or replace function private.save_code_reset_score()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  update private.save_codes set score = null where profile_id = new.id;
  return new;
end $$;
revoke all on function private.save_code_reset_score() from public;
revoke all on function private.save_code_reset_score() from anon, authenticated;
drop trigger if exists save_code_reset_score on public.profiles;
create trigger save_code_reset_score
  after update of reset_all on public.profiles
  for each row when (old.reset_all is true and new.reset_all is false)
  execute function private.save_code_reset_score();

notify pgrst, 'reload schema';
