-- 091_econ_guard.sql - SERVER-SIDE ECONOMY GUARD (Andy nov21: "protect from source code attacks (some guy is giving
-- himself wins and gems)").
--
-- WHAT WAS FOUND ON PRODUCTION (read-only, public board data, nov21):
--   * WINS and GEMS live only in the browser (taw.s2.* in localStorage). The server never holds a balance. What it does
--     store is what the browser REPORTS: level, rebirths, lifetime words / letters and "wins per word" (the number the
--     profile card and the board show), plus a showcase (base wins, wins per word, power ...).
--   * Honest players sit on one tight line: log10(wins per word) ~= 0.7 + 0.73 x rebirths (3,000 season-2 rows; the
--     highest honest row is 5.5 orders above the line). Three rows are 20 to 45 ORDERS OF MAGNITUDE above it - a number a
--     save can only reach by editing it: GameTooEasyLmao (R110, #1 on the board, 10^126 wins a word with 384 game words in
--     total), jsat (R7, 10^34) and xav (R5, 10^24).
--   * The board took those numbers verbatim (070 / 064 only shape-check them), and with an edited XP total the level -
--     and so lb_rebirth's gate - is free: 384 words bought 110 rebirths.
--
-- WHAT THIS FILE DOES (triggers, so EVERY writer - lb_submit3, lb_rebirth, lb_showcase_set, the SQL editor - is covered,
-- and no live RPC body changes):
--   1. private.econ_audit - an append-only log of every guard action (what was sent, what was kept, why).
--   2. WINS PER WORD CEILING. A non-bot, non-tester row may claim at most 10^(8 + 0.85 x rebirths) wins a word (two
--      orders above the highest honest row today, and the slope is steeper than the economy's own). Above it the number is
--      CLAMPED to the ceiling and logged. Same rule on public.profile_showcase.wins_per_word (the profile card).
--   3. AUTO-HIDE, NEVER DELETE. A claim more than 10^4 x the ceiling (a million times past any honest save) sets
--      profiles.lb_hidden: 092 keeps that row off the ALL TIME and THIS WEEK boards and out of the weekly gem prizes. The
--      row, its save and its gear are untouched; the player can still play. FLAG, DON'T BAN (032 / 037).
--   4. WORDS BANK. lb_board_write_s2 lets lifetime words rise 4 a second since the last accepted write, with NO limit on
--      how long that bank grows - idle a day, then claim 345,600 words in one write (each one raises the gem budget by
--      375). The bank now stops at 2 hours (28,800 words a write; the fastest honest typist on the board averaged 0.5 a
--      second over 4 hours), and a first season-2 write claims at most 100,000 words. Over it the words are CLAMPED (the
--      write still lands, the row catches up on the next writes) - never refused, so no row can get stuck.
--      4b. 070's REBIRTH CATCH-UP (a write lifting rebirths to the save's count, up to words / 10) had no pace at all -
--      one write could add hundreds of rebirths past lb_rebirth's 40 a day. It now shares lb_rebirth's pace (Andy nov26
--      "yes close them": 20 a rolling 24 h, 12 an hour), counting lb_rebirth's grants AND earlier catch-ups together.
--      4c. LEVEL RATE (Andy nov26): a board write may lift the level 1 every 10 s since the last write (was 1 a second,
--      banking 20 min - 3,600 levels an hour; the fastest honest player gains ~1,850 levels in 24 h nonstop, sim
--      nov26), never below the next rebirth gate + 100, so an honest climb to the gate is never touched.
--   5. REBIRTHS WITH ALMOST NO TYPING are LOGGED (not refused - 074 removed the words gate on purpose): a rebirth with
--      fewer than 3 game words since the last one is an audit row, for review.
--   6. private.econ_suspects - one view to read it all (SQL editor).
--   7. A one-time pass applies 2 + 3 to the rows already over the line, logging their old numbers first.
--
-- TESTERS (is_tester) and BOARD BOTS (is_bot) skip every check. Season-1 rows (econ <> 13) are left alone.
-- ORDER: after 089 (and after 090 if it is run). Then 092, then 093. RE-RUNNABLE. ASCII only.
-- WRITE-ONLY: Claude never runs migrations. HOW: Supabase -> SQL editor -> paste the WHOLE file -> Run.

-- ---- 0. the hide flag --------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists lb_hidden boolean not null default false;
alter table public.profiles add column if not exists lb_hidden_at timestamptz;
alter table public.profiles add column if not exists lb_hidden_why text;

-- ---- 1. the audit log --------------------------------------------------------------------------------------------------
create table if not exists private.econ_audit (
  id bigserial primary key,
  profile_id uuid not null,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists econ_audit_profile_at on private.econ_audit (profile_id, created_at desc);
revoke all on private.econ_audit from public;
revoke all on private.econ_audit from anon, authenticated;

-- one audit row; p_every throttles a repeating kind (a cheater's client writes every few seconds)
create or replace function private.econ_audit_add(p_pid uuid, p_kind text, p_detail jsonb, p_every interval default null)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if p_every is not null and exists (select 1 from private.econ_audit
                                      where profile_id = p_pid and kind = p_kind and created_at > now() - p_every) then
    return;
  end if;
  insert into private.econ_audit (profile_id, kind, detail) values (p_pid, p_kind, coalesce(p_detail, '{}'::jsonb));
end $$;
revoke all on function private.econ_audit_add(uuid, text, jsonb, interval) from public;
revoke all on function private.econ_audit_add(uuid, text, jsonb, interval) from anon, authenticated;

-- ---- 2. the ceiling (log10 of the most wins a word a row at R rebirths may claim) -------------------------------------
create or replace function private.wpw_cap_log10(p_rebirths integer)
returns numeric language sql immutable as $$
  select 8 + 0.85 * greatest(0, coalesce(p_rebirths, 0))::numeric
$$;
revoke all on function private.wpw_cap_log10(integer) from public;
revoke all on function private.wpw_cap_log10(integer) from anon, authenticated;

-- ---- 3. the profiles guard ---------------------------------------------------------------------------------------------
create or replace function private.econ_guard_profile()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare caplog numeric; sentlog numeric; secs numeric; allow bigint; excess bigint; since bigint;
        day_rise integer; hour_rise integer; rise integer; lv_cap bigint;
        CATCHUP_PER_DAY constant integer := 20;     -- lb_rebirth's 24 h pace (094, Andy nov26; was 40)
        CATCHUP_PER_HOUR constant integer := 12;    -- lb_rebirth's hour pace (033)
        LEVEL_SECS constant integer := 10;          -- 4c: one level per 10 s since the last write (070 allowed 1 a second)
        LEVEL_BANK_SECS constant integer := 1200;   -- 070's 20-minute bank
        HIDE_ORDERS constant numeric := 4;          -- auto-hide past 10^4 x the ceiling
        WORDS_PER_SEC constant integer := 4;        -- 039's word pace
        WORDS_BANK_SECS constant integer := 7200;   -- the word bank stops at 2 hours
        FIRST_WORDS_MAX constant bigint := 100000;  -- a first season-2 write (the most played honest row has ~13,000)
        FEW_WORDS constant integer := 3;            -- a rebirth with fewer game words than this since the last is logged
begin
  if coalesce(new.is_bot, false) or coalesce(new.is_tester, false) or new.econ is distinct from 13 then
    return new;
  end if;

  -- 4. WORDS BANK: only on a board write (lb_board_write_s2 moves submitted_at)
  if tg_op = 'UPDATE' and new.submitted_at is distinct from old.submitted_at then
    if old.submitted_at is null or old.econ is distinct from 13 then
      allow := greatest(0, greatest(coalesce(old.lifetime_words, 0), FIRST_WORDS_MAX) - coalesce(old.lifetime_words, 0));
    else
      secs := greatest(1, extract(epoch from (now() - old.submitted_at)));
      allow := floor(WORDS_PER_SEC * least(secs, WORDS_BANK_SECS))::bigint;
    end if;
    excess := coalesce(new.lifetime_words, 0) - coalesce(old.lifetime_words, 0) - allow;
    if excess > 0 then
      perform private.econ_audit_add(new.id, 'words_bank', jsonb_build_object(
        'sent', new.lifetime_words, 'kept', coalesce(old.lifetime_words, 0) + allow, 'was', old.lifetime_words,
        'secs', round(coalesce(secs, 0))), interval '10 minutes');
      new.lifetime_words := coalesce(old.lifetime_words, 0) + allow;
      new.week_words := greatest(0, coalesce(new.week_words, 0) - excess);
    end if;

    -- 4b. REBIRTH CATCH-UP PACE: 070 lets a later write lift rebirths to the save's count (words / 10). That bypassed
    -- lb_rebirth's 40-a-day pace entirely (one write could add hundreds). A catch-up now shares that pace: at most 40
    -- rebirths a rolling 24 h through board writes, and words / 10 is re-checked on the CLAMPED words. A row behind its
    -- save still converges (daan's R2 -> R26 needed 24) - over a day or two instead of one write.
    if old.submitted_at is not null and old.econ = 13 and new.rebirths > old.rebirths then
      -- one shared budget: earlier catch-ups + lb_rebirth's granted rebirths
      select coalesce(sum((a.detail->>'rise')::integer) filter (where a.created_at > now() - interval '24 hours'), 0),
             coalesce(sum((a.detail->>'rise')::integer) filter (where a.created_at > now() - interval '1 hour'), 0)
        into day_rise, hour_rise from private.econ_audit a
       where a.profile_id = new.id and a.kind = 'rb_catchup' and a.created_at > now() - interval '24 hours';
      select day_rise + count(*), hour_rise + count(*) filter (where r.created_at > now() - interval '1 hour')
        into day_rise, hour_rise from public.rebirth_requests r
       where r.profile_id = new.id and r.action = 'rebirth' and (r.result->>'ok')::boolean
         and r.created_at > now() - interval '24 hours';
      rise := least(new.rebirths - old.rebirths,
                    greatest(0, CATCHUP_PER_DAY - day_rise),
                    greatest(0, CATCHUP_PER_HOUR - hour_rise),
                    greatest(0, floor(coalesce(new.lifetime_words, 0) / 10.0)::integer - old.rebirths));
      if rise < new.rebirths - old.rebirths then
        perform private.econ_audit_add(new.id, 'rb_catchup_cap', jsonb_build_object(
          'sent', new.rebirths, 'kept', old.rebirths + rise, 'was', old.rebirths, 'day_rise', day_rise,
          'hour_rise', hour_rise, 'words', new.lifetime_words), interval '10 minutes');
        new.rebirths := old.rebirths + rise;
      end if;
      if rise > 0 then
        perform private.econ_audit_add(new.id, 'rb_catchup', jsonb_build_object('rise', rise, 'from', old.rebirths));
      end if;
    end if;

    -- 4c. LEVEL RATE: never below the next gate + 100 (070's headroom, on the KEPT rebirths), else 1 level a 10 s
    if old.submitted_at is not null and old.econ = 13 and new.level > old.level then
      lv_cap := greatest(15 + 18 * new.rebirths::bigint + 100,
                         old.level + floor(least(secs, LEVEL_BANK_SECS) / LEVEL_SECS)::bigint);
      if new.level > lv_cap then
        perform private.econ_audit_add(new.id, 'level_rate', jsonb_build_object(
          'sent', new.level, 'kept', lv_cap, 'was', old.level, 'rebirths', new.rebirths,
          'secs', round(secs)), interval '10 minutes');
        new.level := lv_cap::integer;
      end if;
    end if;
  end if;

  -- 2 + 3. WINS PER WORD CEILING + AUTO-HIDE
  -- judged only when the CLAIM changes (a client write). A rebirths change alone (lb_rebirth, a reset, an ascend) never
  -- re-judges a stored number, and a row with stars (lb_ascend, off since 029) is skipped: its rebirths restarted at 0.
  if coalesce(new.wins_per_word, 0) > 0 and coalesce(new.stars, 0) = 0
     and (tg_op = 'INSERT' or new.wins_per_word is distinct from old.wins_per_word) then
    caplog := private.wpw_cap_log10(new.rebirths);
    sentlog := log(10::numeric, new.wins_per_word::numeric);
    if sentlog > caplog then
      perform private.econ_audit_add(new.id, 'wpw_clamp', jsonb_build_object(
        'sent_log10', round(sentlog, 1), 'cap_log10', round(caplog, 1), 'rebirths', new.rebirths,
        'level', new.level, 'words', new.lifetime_words), interval '10 minutes');
      if sentlog > caplog + HIDE_ORDERS and not coalesce(new.lb_hidden, false) then
        new.lb_hidden := true;
        new.lb_hidden_at := now();
        new.lb_hidden_why := 'wins_per_word';
        perform private.econ_audit_add(new.id, 'auto_hide', jsonb_build_object(
          'why', 'wins_per_word', 'sent_log10', round(sentlog, 1), 'cap_log10', round(caplog, 1),
          'rebirths', new.rebirths, 'level', new.level, 'words', new.lifetime_words));
        begin
          perform private.cheat_flag(new.id, 'clamped', jsonb_build_object('wpw_log10', round(sentlog, 1),
                                                                          'cap_log10', round(caplog, 1), 'hidden', true));
        exception when others then null; end;
      end if;
      new.wins_per_word := round(power(10::numeric, caplog), 1);
    end if;
  end if;

  -- 5. A REBIRTH WITH ALMOST NO TYPING (lb_rebirth: rebirths + 1, level 1): logged only
  if tg_op = 'UPDATE' and new.rebirths = old.rebirths + 1 and new.level = 1 then
    since := coalesce(new.lifetime_words, 0) - coalesce(old.rb_words0, 0);
    if since < FEW_WORDS then
      perform private.econ_audit_add(new.id, 'rebirth_few_words', jsonb_build_object(
        'rebirths', new.rebirths, 'words_since', since, 'words', new.lifetime_words));
    end if;
  end if;
  return new;
end $$;
revoke all on function private.econ_guard_profile() from public;
revoke all on function private.econ_guard_profile() from anon, authenticated;

drop trigger if exists lb_econ_guard on public.profiles;
create trigger lb_econ_guard before insert or update on public.profiles
  for each row execute function private.econ_guard_profile();

-- ---- 2 on the profile card (public.profile_showcase, written by lb_showcase_set) ---------------------------------------
create or replace function private.econ_guard_showcase()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare p record; caplog numeric; sentlog double precision;
begin
  if coalesce(new.wins_per_word, 0) <= 0 then return new; end if;
  select rebirths, stars, is_bot, is_tester, econ into p from public.profiles where id = new.profile_id;
  if not found or coalesce(p.is_bot, false) or coalesce(p.is_tester, false) or p.econ is distinct from 13
     or coalesce(p.stars, 0) > 0 then
    return new;
  end if;
  caplog := private.wpw_cap_log10(p.rebirths);
  sentlog := log(new.wins_per_word);
  if sentlog > caplog then
    perform private.econ_audit_add(new.profile_id, 'show_wpw_clamp', jsonb_build_object(
      'sent_log10', round(sentlog::numeric, 1), 'cap_log10', round(caplog, 1), 'rebirths', p.rebirths,
      'power', new.power, 'base_wins', new.base_wins), interval '10 minutes');
    new.wins_per_word := power(10::double precision, least(caplog, 300)::double precision);
  end if;
  return new;
end $$;
revoke all on function private.econ_guard_showcase() from public;
revoke all on function private.econ_guard_showcase() from anon, authenticated;

drop trigger if exists lb_econ_guard_show on public.profile_showcase;
create trigger lb_econ_guard_show before insert or update on public.profile_showcase
  for each row execute function private.econ_guard_showcase();

-- ---- 7. the rows already over the line: log what they hold, then clamp (+ hide past the hide line) --------------------
insert into private.econ_audit (profile_id, kind, detail)
select p.id, 'backfill', jsonb_build_object('wins_per_word', p.wins_per_word::text, 'rebirths', p.rebirths,
                                            'level', p.level, 'words', p.lifetime_words, 'letters', p.lifetime_letters,
                                            'roll_spent', p.s2_roll_spent,
                                            'sent_log10', round(log(10::numeric, p.wins_per_word::numeric), 1),
                                            'cap_log10', round(private.wpw_cap_log10(p.rebirths), 1))
  from public.profiles p
 where not p.is_bot and not coalesce(p.is_tester, false) and p.econ = 13 and coalesce(p.stars, 0) = 0 and p.wins_per_word > 0
   and log(10::numeric, p.wins_per_word::numeric) > private.wpw_cap_log10(p.rebirths)
   and not exists (select 1 from private.econ_audit a where a.profile_id = p.id and a.kind = 'backfill');

update public.profiles p
   set lb_hidden = true, lb_hidden_at = now(), lb_hidden_why = 'wins_per_word'
 where not p.is_bot and not coalesce(p.is_tester, false) and p.econ = 13 and coalesce(p.stars, 0) = 0 and p.wins_per_word > 0 and not p.lb_hidden
   and log(10::numeric, p.wins_per_word::numeric) > private.wpw_cap_log10(p.rebirths) + 4;

update public.profiles p
   set wins_per_word = round(power(10::numeric, private.wpw_cap_log10(p.rebirths)), 1)
 where not p.is_bot and not coalesce(p.is_tester, false) and p.econ = 13 and coalesce(p.stars, 0) = 0 and p.wins_per_word > 0
   and log(10::numeric, p.wins_per_word::numeric) > private.wpw_cap_log10(p.rebirths);

-- the card: touching the value makes the trigger clamp it (it logs show_wpw_clamp with the old number)
update public.profile_showcase s
   set wins_per_word = s.wins_per_word * 1
  from public.profiles p
 where p.id = s.profile_id and not p.is_bot and not coalesce(p.is_tester, false) and p.econ = 13 and coalesce(p.stars, 0) = 0
   and s.wins_per_word > 0 and log(s.wins_per_word)::numeric > private.wpw_cap_log10(p.rebirths);

-- ---- 6. the review list (SQL editor only):  select * from private.econ_suspects; ---------------------------------------
--   wpw_over_cap      orders of magnitude the stored wins / word sits past the ceiling (clamped rows read 0)
--   words_per_rb      lifetime game words per rebirth (honest top rows: 35 to 125)
--   spent_vs_budget   gems spent on server rolls / private.gem_budget (honest rows: under 0.4)
create or replace view private.econ_suspects as
select p.username, p.lb_hidden, p.rebirths, p.level, p.lifetime_words,
       round(p.lifetime_words::numeric / greatest(1, p.rebirths), 1) as words_per_rb,
       case when p.wins_per_word > 0
            then round(log(10::numeric, p.wins_per_word::numeric) - private.wpw_cap_log10(p.rebirths), 1) end as wpw_over_cap,
       p.s2_roll_spent,
       round(p.s2_roll_spent::numeric / greatest(1, private.gem_budget(p.id)), 2) as spent_vs_budget,
       (select count(*) from private.econ_audit a where a.profile_id = p.id) as audit_rows,
       (select max(a.created_at) from private.econ_audit a where a.profile_id = p.id) as last_audit,
       (select count(*) from private.econ_audit a where a.profile_id = p.id and a.kind = 'rebirth_few_words') as few_word_rebirths,
       p.created_at, p.updated_at, p.id
  from public.profiles p
 where not p.is_bot and not coalesce(p.is_tester, false) and p.econ = 13
   and (p.lb_hidden
        or exists (select 1 from private.econ_audit a where a.profile_id = p.id)
        or (p.rebirths >= 5 and p.lifetime_words < 3 * p.rebirths))
 order by p.lb_hidden desc, audit_rows desc, p.rebirths desc;
revoke all on private.econ_suspects from public;
revoke all on private.econ_suspects from anon, authenticated;

notify pgrst, 'reload schema';

-- CHECK (SQL editor):
--   select * from private.econ_suspects;
--   select a.created_at, p.username, a.kind, a.detail from private.econ_audit a join public.profiles p on p.id = a.profile_id
--    order by a.created_at desc limit 100;
