-- 032_board_caps_and_ban.sql — Andy oct11: "is there a way to prevent people from mingling with the source code (like
-- changing progress of level)" + "a code so i can get someone off leaderboard (for cheating) (and maybe reset progress or
-- account)".
--
--   1. TIGHTER LEVEL CAP on the season-2 board write (private.lb_board_write_s2, 029's body otherwise unchanged):
--        levels past the next rebirth gate 100 → 30; the climb allowance +1 → +0.2 level a second (honest ≈ 0.04/s),
--        still banking 20 min. A faked level is CLAMPED (never rejected) to what the clock allows.
--   2. BAN: private.banned — a banned profile's board writes are ignored, and the ban hides the row from both
--      season-2 boards (they list econ = 13 rows only). lb_rebirth already refuses a non-econ-13 row, and a hidden row's
--      profile card can't be opened (it is never on the board).
--
-- ADMIN (run in the SQL editor — find the name first: select id, username, level, rebirths from profiles where username ilike 'NAME';)
--   BAN:    insert into private.banned (profile_id, reason) select id, 'cheating' from public.profiles where username = 'NAME' on conflict do nothing;
--           update public.profiles set econ = 0 where username = 'NAME';
--   UNBAN:  delete from private.banned where profile_id = (select id from public.profiles where username = 'NAME');
--           (their next submit re-enters the board as a fresh season-2 baseline)
--   RESET PROGRESS (012, keeps the name): update public.profiles set reset_all = true where username = 'NAME';
--           (their browser wipes every taw.* key on its next menu load and zeroes the board row)
--   DELETE ACCOUNT: delete from public.profiles where username = 'NAME';
--           (the name frees up; their device starts over unnamed)
--
-- KEEP IN SYNC WITH src/leaderboard/finalRules.js (F_LV_HEADROOM, F_LEVELS_PER_SEC) — finalRules.test.js pins this file.
-- WRITE-ONLY: Claude never runs migrations. Safe to re-run.

create table if not exists private.banned (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  reason text,
  at timestamptz not null default now()
);
revoke all on private.banned from public, anon, authenticated;

-- ---- the season-2 board write: 029's, with the tighter level cap and the ban check ------------------------------
create or replace function private.lb_board_write_s2(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv bigint; rb bigint; w bigint; l bigint; wk date; delta bigint;
        secs numeric; base_lv bigint; max_rise bigint; is_reset boolean; lv_cap bigint;
        F_ECON constant smallint := 13;
        F_GATE_BASE constant integer := 15;        -- the rebirth gate: LV 15 + 18 × R
        F_GATE_STEP constant integer := 18;
        F_LV_HEADROOM constant integer := 30;      -- levels allowed past the next gate (032: was 100)
        F_LEVELS_PER_SEC constant numeric := 0.2;  -- or + 0.2 level a second since the last accepted write … (032: was 1; honest ≈ 0.04)
        F_LEVEL_BANK_SECS constant integer := 1200; -- … banking 20 min
        F_WORDS_PER_RB constant integer := 100;    -- a first season-2 write: rebirths ≤ lifetime words / 100
        F_LV_MAX constant bigint := 2147483647;    -- the int column
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  if exists (select 1 from private.banned where profile_id = pid) then return; end if; -- 032: a banned row never writes
  select * into old from public.profiles where id = pid for update;
  if old.submitted_at is not null and old.submitted_at >= now() - interval '5 seconds' then
    return; -- throttled
  end if;
  lv := greatest(1, coalesce(p_level, 1));
  rb := greatest(0, coalesce(p_rebirths, 0));
  w := greatest(0, coalesce(p_lifetime_words, 0));
  l := greatest(0, coalesce(p_lifetime_letters, 0));
  delta := 0;
  if old.submitted_at is null or old.econ is distinct from F_ECON then
    -- FIRST season-2 write: a baseline, bounded by its own play
    rb := least(rb, floor(w / F_WORDS_PER_RB)::bigint);
    lv := least(lv, least(F_LV_MAX, F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM));
  else
    secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
    max_rise := floor(least(secs, F_LEVEL_BANK_SECS) * F_LEVELS_PER_SEC)::bigint;
    is_reset := rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters
                or (lv < old.level and rb = old.rebirths);
    if not is_reset then
      if w - old.lifetime_words > 20 * secs then return; end if;
      if l - old.lifetime_letters > 150 * secs then return; end if;
    end if;
    rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths (lb_rebirth only)
    base_lv := case when is_reset then 1 else old.level end;
    lv_cap := least(F_LV_MAX, greatest(F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM, base_lv + max_rise));
    if is_reset then
      lv := least(lv, greatest(old.level::bigint, lv_cap));
      w := least(w, old.lifetime_words + floor(20 * secs)::bigint);
      l := least(l, old.lifetime_letters + floor(150 * secs)::bigint);
    else
      lv := least(lv, lv_cap);
      delta := greatest(0, w - coalesce(old.lifetime_words, 0));
    end if;
  end if;
  wk := (date_trunc('week', now() at time zone 'America/New_York'))::date;
  update public.profiles
     set level = lv::integer, rebirths = rb::integer, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, round(coalesce(p_wins_per_word, 0), 1)),
         week_words = case when week_key = wk then week_words + delta else delta end,
         week_key = wk,
         econ = F_ECON,
         submitted_at = now(), updated_at = now()
   where id = pid; -- stars are never written here (lb_ascend only)
end $$;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from public;
revoke all on function private.lb_board_write_s2(text, integer, integer, bigint, bigint, numeric) from anon, authenticated;


