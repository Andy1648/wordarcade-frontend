-- 054_no_lower_board_writes.sql — Andy oct17: "when you log into a new device with the same account it resets account
-- (already signed in), on one device its the same but leaderboard is as if it reset".
--
-- WHY: a board name is a device SECRET (taw.lb.secret + the taw_lb cookie) that every device holding it shares, but the
-- save is per browser and season 2 had the cloud save OFF on the client. So a second device "signed in" with the name
-- started at LV 1, and its first push went through private.lb_board_write_s2 (039), which read a LOWER push as a RESET
-- (017's rule) and wrote LV 1 / R0 over the account's row. The device that held the real save then could not put its
-- rebirths back (a submit never raises rebirths). The client now restores the cloud save first and never pushes while
-- behind its row (src/leaderboard/boardGuard.js); this file makes the SERVER refuse such a write too, for old bundles
-- still open in a tab and for two devices racing.
--
--   1. private.lb_board_write_s2 — 039's body, but a lower write (rebirths, words or letters down, or the level down at
--      the same rebirths) is REFUSED (no change), never a reset. Resets go through lb_self_reset / lb_reset_ack only.
--   2. public.lb_submit3 — 032's body; a refused LOWER write is not flagged 'rejected' (it is not a cheat).
--   3. public.lb_reset_ack (012, used by lb_self_reset) — also zeroes ★ STARS (it predates them), so a reset row is
--      really zero and the client's behind-the-row check can't hold a reset player's pushes back.
-- MIRRORED in src/leaderboard/finalRules.js (decideSubmitFinal: 'refused'); noLowerWrites.test.js pins it.
-- ORDER: after 039 (and 032). WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

-- ---- 1. the season-2 board write: a lower write is refused -------------------------------------------------------
create or replace function private.lb_board_write_s2(p_secret text, p_level integer, p_rebirths integer,
                                                     p_lifetime_words bigint, p_lifetime_letters bigint,
                                                     p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv bigint; rb bigint; w bigint; l bigint; wk date; delta bigint;
        secs numeric; max_rise bigint; is_reset boolean; lv_cap bigint;
        F_ECON constant smallint := 13;
        F_GATE_BASE constant integer := 15;        -- the rebirth gate: LV 15 + 18 × R
        F_GATE_STEP constant integer := 18;
        F_LV_HEADROOM constant integer := 100;     -- levels allowed past the next gate
        F_LEVELS_PER_SEC constant integer := 1;    -- or + 1 level a second since the last accepted write …
        F_LEVEL_BANK_SECS constant integer := 1200; -- … banking 20 min
        F_WORDS_PER_RB constant integer := 100;    -- a first season-2 write: rebirths ≤ lifetime words / 100
        F_LV_MAX constant bigint := 2147483647;    -- the int column
        -- 039: game words arrive at most 4 a second (240 wpm — no human types faster in a game; was 20)
begin
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
    -- 054: a LOWER write is REFUSED, never a reset. A board name is a device secret every device holding it shares;
    -- a fresh / wiped device pushed its LV 1 save here and the account looked reset everywhere (Andy oct17). Resets go
    -- through lb_self_reset / lb_reset_ack only (they zero the row themselves).
    if is_reset then return; end if;
    if w - old.lifetime_words > 4 * secs then return; end if;
    if l - old.lifetime_letters > 150 * secs then return; end if;
    rb := least(rb, old.rebirths::bigint); -- a submit never raises rebirths (lb_rebirth only)
    lv_cap := least(F_LV_MAX, greatest(F_GATE_BASE + F_GATE_STEP * rb + F_LV_HEADROOM, old.level + max_rise));
    lv := least(lv, lv_cap);
    delta := greatest(0, w - coalesce(old.lifetime_words, 0));
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

-- ---- 2. lb_submit3: no 'rejected' flag for a refused lower write -------------------------------------------------
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
        -- 054: a LOWER write (a second device behind the row) is refused too — that is not a cheat, so no flag
        if not (coalesce(p_rebirths, 0) < old.rebirths or coalesce(p_lifetime_words, 0) < old.lifetime_words
                or coalesce(p_lifetime_letters, 0) < old.lifetime_letters
                or (coalesce(p_level, 1) < old.level and coalesce(p_rebirths, 0) = old.rebirths)) then
          perform private.cheat_flag(pid, 'rejected', sent);     -- 029 refused it (words / letters too fast)
        end if;
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

-- ---- 3. lb_reset_ack: ★ back to 0 as well ------------------------------------------------------------------------
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
     set level = 1, rebirths = 0, stars = 0, lifetime_words = 0, lifetime_letters = 0, wins_per_word = 0,
         reset_all = false, submitted_at = now(), updated_at = now()
   where id = pid;
  return json_build_object('reset', true);
end $$;
revoke all on function public.lb_reset_ack(text, text, numeric) from public;
grant execute on function public.lb_reset_ack(text, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
