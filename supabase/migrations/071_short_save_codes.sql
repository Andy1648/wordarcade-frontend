-- 071_short_save_codes.sql — SHORT SAVE CODES (Andy oct27: "much shorter, so copying them isn't a hassle … def ensure
-- nothing can go wrong with the save codes").
--
-- The long TAW2 code (src/save/saveCode.js: gzip + CRC-32, often 30–100k characters) is stored HERE, server-side, under a
-- 10-character code from an unambiguous alphabet (no 0 / O / 1 / I / L): e.g. K7M2QX9PAH, shown as K7M2Q-X9PAH.
--   * ONE code per board account, kept for good: COPY again replaces what it holds (replace-on-reissue), so a player
--     only ever has to remember one code, and it always loads the save they copied last.
--   * the stored value IS the TAW2 code, checksum and all: the client re-verifies the CRC and the whole save before it
--     writes a single key, exactly as for a pasted long code — a damaged row can never be half-applied.
--   * caps: 1 MB a code; a re-copy within 3 s keeps the last copy; ≤ 600 new codes an hour site-wide; a wrong code is
--     logged and ≥ 60 misses a minute site-wide answers 'busy' (31^10 ≈ 8·10^14 codes — guessing one is hopeless).
--   * the code carries the board account (the client puts the device secret in the save it uploads), so a code is a
--     KEY to the account — exactly like the recovery code it replaces in practice.
-- The client degrades without this file: lb_save_code_put / _get answer PGRST202 → COPY gives the long TAW2 code.
-- ORDER: any time (after 001). WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists private.save_codes (
  code text primary key check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$'),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  blob text not null check (length(blob) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  loads integer not null default 0
);
create index if not exists save_codes_created_idx on private.save_codes (created_at desc);
revoke all on private.save_codes from public;
revoke all on private.save_codes from anon, authenticated;

create table if not exists private.save_code_misses (at timestamptz not null default now());
create index if not exists save_code_misses_at_idx on private.save_code_misses (at desc);
revoke all on private.save_code_misses from public;
revoke all on private.save_code_misses from anon, authenticated;

-- ---- PUT: this account's save → its code ------------------------------------------------------------------------------
create or replace function public.lb_save_code_put(p_secret text, p_blob text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; cur private.save_codes; c text; i integer; tries integer := 0;
        ALPHA constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- 31 symbols: no 0 O 1 I L
        MAX_BLOB constant integer := 1048576;
        NEW_PER_HOUR constant integer := 600;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if p_blob is null or length(p_blob) > MAX_BLOB or left(p_blob, 5) <> 'TAW2.' then
    return json_build_object('ok', false, 'reason', 'bad_blob');
  end if;
  select * into cur from private.save_codes where profile_id = pid for update;
  if found then
    if cur.updated_at > now() - interval '3 seconds' then
      return json_build_object('ok', true, 'code', cur.code, 'kept', true); -- a double tap: the copy a moment ago stands
    end if;
    update private.save_codes set blob = p_blob, updated_at = now() where profile_id = pid;
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
    insert into private.save_codes (code, profile_id, blob) values (c, pid, p_blob) on conflict do nothing;
    if found then return json_build_object('ok', true, 'code', c); end if;
    -- a collision on the code (or a racing first copy on the profile): the profile's row wins if it exists now
    select * into cur from private.save_codes where profile_id = pid;
    if found then
      update private.save_codes set blob = p_blob, updated_at = now() where profile_id = pid;
      return json_build_object('ok', true, 'code', cur.code);
    end if;
    if tries >= 8 then return json_build_object('ok', false, 'reason', 'busy'); end if;
  end loop;
end $$;
revoke all on function public.lb_save_code_put(text, text) from public;
grant execute on function public.lb_save_code_put(text, text) to anon, authenticated;

-- ---- GET: a code → the save it holds -----------------------------------------------------------------------------------
create or replace function public.lb_save_code_get(p_code text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare c text; b text;
        MISSES_PER_MIN constant integer := 60;
begin
  c := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if c !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$' then
    return json_build_object('ok', false, 'reason', 'bad_code');
  end if;
  if (select count(*) from private.save_code_misses where at > now() - interval '1 minute') >= MISSES_PER_MIN then
    return json_build_object('ok', false, 'reason', 'busy');
  end if;
  update private.save_codes set loads = loads + 1 where code = c returning blob into b;
  if b is null then
    insert into private.save_code_misses (at) values (now());
    delete from private.save_code_misses where at < now() - interval '1 hour';
    return json_build_object('ok', false, 'reason', 'not_found');
  end if;
  return json_build_object('ok', true, 'blob', b);
end $$;
revoke all on function public.lb_save_code_get(text) from public;
grant execute on function public.lb_save_code_get(text) to anon, authenticated;

notify pgrst, 'reload schema';
