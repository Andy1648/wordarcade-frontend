-- 032_testers_and_flags.sql — ANTI-CHEAT WITHOUT BANNING THE TEST ACCOUNTS (Andy oct11: "is there a way to protect
-- against [cheating] without banning my test accounts if i give myself an op code").
--
-- THE "OP CODE" IS A SERVER COLUMN, never a code in the bundle (the bundle is public — a code in it is a code for
-- everyone). Only the SQL editor can set it.
--
--   1. public.profiles.is_tester (default false). A TESTER's season-2 board write skips 029's rate / level caps: the
--      numbers it submits are stored as sent (still ≥ 0, level ≥ 1, inside the int column). Testers are never flagged.
--      Testers stay ON the public board like anyone else (so the board can be tested). The rebirth GATE / PACE in
--      lb_rebirth are unchanged — a tester meets the gate by submitting the level.
--   2. FLAG, DON'T BAN. Every non-tester season-2 submit that 029's caps REJECT (words > 20/s, letters > 150/s) or
--      CLAMP (stored level / words / letters lower than sent, without a reset) logs one row in private.cheat_flags
--      (≤ 1 per profile per reason per hour). Nothing is auto-removed — Andy reviews private.cheat_review and decides.
--      A false positive costs nothing: a flag is a note, not a penalty.
--
-- REVIEW (SQL editor):  select * from private.cheat_review;
-- ADD A TESTER:         update public.profiles set is_tester = true where lower(username) = lower('<name>');
-- REMOVE A TESTER:      update public.profiles set is_tester = false where lower(username) = lower('<name>');
--
-- ORDER: after 029 (it wraps 029's private.lb_board_write_s2, which is NOT redefined — finalRules.test.js still pins
-- 029). Re-declares 022's public.lb_submit3 with the same signature and the same season-1 branch. If 022 is ever
-- re-run, re-run this file after it. Then: notify pgrst, 'reload schema';
--
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

do $$
begin
  if to_regprocedure('private.lb_board_write_s2(text,integer,integer,bigint,bigint,numeric)') is null then
    raise exception '032 needs 022 + 029 — run them first, then this file';
  end if;
end $$;

-- ---- 1. the tester column (+ the first tester) ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_tester boolean not null default false;
update public.profiles set is_tester = true where lower(username) = lower('millie');

-- ---- 2. the flag log (private: no anon / authenticated access) -----------------------------------------------------
create table if not exists private.cheat_flags (
  id bigserial primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('rejected', 'clamped')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cheat_flags_profile_idx on private.cheat_flags (profile_id, reason, created_at desc);
revoke all on private.cheat_flags from public;
revoke all on private.cheat_flags from anon, authenticated;

-- ---- 3. the tester write: numbers as sent (shape only) -------------------------------------------------------------
create or replace function private.lb_board_write_tester(p_pid uuid, p_level integer, p_rebirths integer,
                                                         p_lifetime_words bigint, p_lifetime_letters bigint,
                                                         p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare old public.profiles; w bigint; wk date; delta bigint;
begin
  select * into old from public.profiles where id = p_pid for update;
  w := greatest(0, coalesce(p_lifetime_words, 0));
  delta := case when old.econ = 13 then greatest(0, w - coalesce(old.lifetime_words, 0)) else 0 end;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = least(2147483647, greatest(1, coalesce(p_level, 1)::bigint))::integer,
         rebirths = least(2147483647, greatest(0, coalesce(p_rebirths, 0)::bigint))::integer,
         lifetime_words = w,
         lifetime_letters = greatest(0, coalesce(p_lifetime_letters, 0)),
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = 13,
         submitted_at = now(), updated_at = now()
   where id = p_pid;
end $$;
revoke all on function private.lb_board_write_tester(uuid, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_tester(uuid, integer, integer, bigint, bigint, numeric) from anon, authenticated;

-- one flag per profile per reason per hour
create or replace function private.cheat_flag(p_pid uuid, p_reason text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if exists (select 1 from private.cheat_flags
              where profile_id = p_pid and reason = p_reason and created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into private.cheat_flags (profile_id, reason, detail) values (p_pid, p_reason, p_detail);
end $$;
revoke all on function private.cheat_flag(uuid, text, jsonb) from public;
revoke all on function private.cheat_flag(uuid, text, jsonb) from anon, authenticated;

-- ---- 4. lb_submit3: 022's body + the tester branch + flag-don't-ban around 029's write ------------------------------
create or replace function public.lb_submit3(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric,
                                             p_econ integer)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare cur smallint; pid uuid; old public.profiles; nw public.profiles; sent jsonb;
begin
  if p_econ = 13 then
    pid := private.profile_for_secret(p_secret);
    if pid is null then raise exception 'no_profile'; end if;
    select * into old from public.profiles where id = pid;
    if old.is_tester then
      perform private.lb_board_write_tester(pid, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters, p_wins_per_word);
      return;
    end if;
    perform private.lb_board_write_s2(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters, p_wins_per_word);
    -- FLAG, DON'T BAN: compare what was sent with what 029 stored (a season-2 row that was not throttled)
    if old.econ = 13 and old.submitted_at is not null and old.submitted_at < now() - interval '5 seconds' then
      select * into nw from public.profiles where id = pid;
      sent := jsonb_build_object('level', p_level, 'rebirths', p_rebirths, 'words', p_lifetime_words,
                                 'letters', p_lifetime_letters,
                                 'was', jsonb_build_object('level', old.level, 'rebirths', old.rebirths,
                                                           'words', old.lifetime_words, 'letters', old.lifetime_letters),
                                 'secs', round(extract(epoch from (now() - old.submitted_at))));
      if nw.submitted_at is not distinct from old.submitted_at then
        perform private.cheat_flag(pid, 'rejected', sent);       -- 029 refused it (words / letters too fast)
      elsif coalesce(p_rebirths, 0) >= old.rebirths
            and (nw.level < coalesce(p_level, 1) or nw.lifetime_words < coalesce(p_lifetime_words, 0)
                 or nw.lifetime_letters < coalesce(p_lifetime_letters, 0)) then
        perform private.cheat_flag(pid, 'clamped', sent);        -- 029 stored less than was sent
      end if;
    end if;
    return;
  end if;
  if p_econ is distinct from 12 then raise exception 'old_client'; end if;
  select econ into cur from public.profiles where id = private.profile_for_secret(p_secret);
  if cur = 13 then raise exception 'old_client'; end if; -- a season-1 client never writes a season-2 row
  perform private.lb_board_write_rr(p_secret, p_level, p_rebirths, p_lifetime_words, p_lifetime_letters,
                                    p_wins_per_word, (12)::smallint); -- econ = 12
end $$;
revoke all on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) from public;
grant execute on function public.lb_submit3(text, integer, integer, bigint, bigint, numeric, integer) to anon, authenticated;

-- ---- 5. the review list (SQL editor only) --------------------------------------------------------------------------
-- Flag counts + a few "odd shape" ratios for EVERY non-tester season-2 row with a flag or an odd ratio:
--   rb_per_kword  rebirths per 1,000 lifetime words (a legit climb needs real typing behind each rebirth)
--   letters_per_word  real words average ~4–9 letters; far outside that = a scripted feed
create or replace view private.cheat_review as
select p.username, p.level, p.rebirths, p.lifetime_words, p.lifetime_letters,
       round(p.rebirths * 1000.0 / greatest(1, p.lifetime_words), 1) as rb_per_kword,
       round(p.lifetime_letters::numeric / greatest(1, p.lifetime_words), 1) as letters_per_word,
       count(f.id) filter (where f.reason = 'rejected') as rejected,
       count(f.id) filter (where f.reason = 'clamped') as clamped,
       max(f.created_at) as last_flag,
       p.id
  from public.profiles p
  left join private.cheat_flags f on f.profile_id = p.id
 where not p.is_tester and p.econ = 13
 group by p.id
having count(f.id) > 0
    or p.rebirths * 1000.0 / greatest(1, p.lifetime_words) > 20
    or (p.lifetime_words >= 200 and p.lifetime_letters::numeric / p.lifetime_words not between 3 and 12)
 order by count(f.id) desc, p.rebirths desc;
revoke all on private.cheat_review from public;
revoke all on private.cheat_review from anon, authenticated;

notify pgrst, 'reload schema';
