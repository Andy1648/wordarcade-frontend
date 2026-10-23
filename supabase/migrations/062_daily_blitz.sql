-- 062_daily_blitz.sql - DAILY BLITZ answer tallies ("X% of players said this").
--
-- DAILY BLITZ (src/dailyBlitz/) is the once-a-day rare-answer game: everyone gets the same six Category Blitz
-- prompts, one answer each, and a rarer answer scores more. The game itself runs entirely in the browser
-- (prompts are seeded by date, answers are judged against the shipped Blitz lists). This migration is the
-- ONLY server part: it counts what everyone answered, so a player can see "31% said Texas" and the score can
-- use the real answer distribution.
--
--   * ONE CALL PER FINISHED DAY: daily_blitz_submit(secret, day, answers[6]) records the six answers and
--     returns the day's tallies in the same round trip. A revisit later in the day reads them again with
--     daily_blitz_tallies(day, answers[6]) (read-only). That is the whole load: two cheap calls per player per
--     day, on Supabase - nothing touches the Render game server (its ~800-player ceiling is untouched).
--   * NO PII, COPPA-safe: no name, no account, no IP. A play is keyed by sha256('taw-db:' || device secret)
--     - the same random per-browser secret the leaderboard already mints (taw.lb.secret) - salted so it can't
--     be joined to anything else, and play rows are purged after 14 days. Answers are list entries
--     ("texas", "axolotl"), validated to [a-z0-9]{1,48}; the tally keeps only the answer and a count.
--   * RATE LIMIT: one counted submission per secret per day (primary key). A repeat submit is a no-op that
--     just returns the tallies. The day must be within 1 of the server's UTC date (every real time zone is).
--   * NO DIRECT TABLE ACCESS: the tables live in `private` with no anon/authenticated grants; the two
--     security-definer functions below are the only doors.
--
-- ORDER: after 061. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to
-- re-run. ASCII only.

create table if not exists private.daily_blitz_plays (
  day date not null,
  who bytea not null,                                         -- sha256('taw-db:' || secret)
  at timestamptz not null default now(),
  primary key (day, who)
);

create table if not exists private.daily_blitz_day (
  day date primary key,
  plays integer not null default 0
);

create table if not exists private.daily_blitz_tally (
  day date not null,
  prompt smallint not null check (prompt between 0 and 5),
  answer text not null check (answer ~ '^[a-z0-9]{1,48}$'),
  n integer not null default 0,
  primary key (day, prompt, answer)
);
create index if not exists daily_blitz_tally_top_idx on private.daily_blitz_tally (day, prompt, n desc);

revoke all on private.daily_blitz_plays from public;
revoke all on private.daily_blitz_day from public;
revoke all on private.daily_blitz_tally from public;
revoke all on private.daily_blitz_plays from anon, authenticated;
revoke all on private.daily_blitz_day from anon, authenticated;
revoke all on private.daily_blitz_tally from anon, authenticated;

-- ---- the read: { plays, prompts: [ { mine, top: [[answer, n] x5] } x6 ] } --------------------------------------
-- `mine` = how many players gave p_answers[i] for prompt i (null for a blank / no answers passed).
create or replace function private.daily_blitz_read(p_day date, p_answers text[])
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
declare
  v_plays integer;
  v_prompts jsonb := '[]'::jsonb;
  v_mine integer;
  v_top jsonb;
  v_ans text;
  i integer;
begin
  select d.plays into v_plays from private.daily_blitz_day d where d.day = p_day;
  for i in 0..5 loop
    v_ans := case when p_answers is null then null else p_answers[i + 1] end;
    v_mine := null;
    if v_ans is not null and v_ans <> '' then
      select t.n into v_mine from private.daily_blitz_tally t where t.day = p_day and t.prompt = i and t.answer = v_ans;
      v_mine := coalesce(v_mine, 0);
    end if;
    select coalesce(jsonb_agg(jsonb_build_array(x.answer, x.n) order by x.n desc, x.answer), '[]'::jsonb) into v_top
      from (select t.answer, t.n from private.daily_blitz_tally t
             where t.day = p_day and t.prompt = i order by t.n desc, t.answer limit 5) x;
    v_prompts := v_prompts || jsonb_build_array(jsonb_build_object('mine', v_mine, 'top', v_top));
  end loop;
  return jsonb_build_object('day', p_day, 'plays', coalesce(v_plays, 0), 'prompts', v_prompts);
end $$;
revoke all on function private.daily_blitz_read(date, text[]) from public;

-- ---- shared argument checks ---------------------------------------------------------------------------------------
create or replace function private.daily_blitz_check(p_day date, p_answers text[])
returns void language plpgsql immutable set search_path = public, private, pg_temp as $$
declare a text;
begin
  if p_day is null then raise exception 'bad_day'; end if;
  if p_answers is null then return; end if;
  if cardinality(p_answers) <> 6 then raise exception 'bad_answers'; end if;
  foreach a in array p_answers loop
    if a is null or (a <> '' and a !~ '^[a-z0-9]{1,48}$') then raise exception 'bad_answers'; end if;
  end loop;
end $$;
revoke all on function private.daily_blitz_check(date, text[]) from public;

-- ---- SUBMIT: count this browser's six answers once, return the day's tallies ----------------------------------
create or replace function public.daily_blitz_submit(p_secret text, p_day date, p_answers text[])
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_who bytea;
  v_today date := (now() at time zone 'utc')::date;
  v_fresh boolean := false;
  i integer;
begin
  if p_secret is null or p_secret !~ '^[0-9a-f]{32,64}$' then raise exception 'bad_secret'; end if;
  perform private.daily_blitz_check(p_day, p_answers);
  if p_answers is null then raise exception 'bad_answers'; end if;
  if p_day < v_today - 1 or p_day > v_today + 1 then raise exception 'bad_day'; end if;

  v_who := extensions.digest('taw-db:' || p_secret, 'sha256');
  insert into private.daily_blitz_plays (day, who) values (p_day, v_who)
  on conflict (day, who) do nothing
  returning true into v_fresh;

  if coalesce(v_fresh, false) then
    insert into private.daily_blitz_day (day, plays) values (p_day, 1)
    on conflict (day) do update set plays = private.daily_blitz_day.plays + 1;
    for i in 0..5 loop
      if p_answers[i + 1] <> '' then
        insert into private.daily_blitz_tally (day, prompt, answer, n) values (p_day, i, p_answers[i + 1], 1)
        on conflict (day, prompt, answer) do update set n = private.daily_blitz_tally.n + 1;
      end if;
    end loop;
    -- retention: play rows (the only per-browser data) live 14 days; the day's counts stay
    if random() < 0.02 then
      delete from private.daily_blitz_plays where day < v_today - 14;
    end if;
  end if;

  return private.daily_blitz_read(p_day, p_answers);
end $$;
revoke all on function public.daily_blitz_submit(text, date, text[]) from public;
grant execute on function public.daily_blitz_submit(text, date, text[]) to anon, authenticated;

-- ---- READ ONLY: the tallies again (a results revisit). Never a future day. ---------------------------------------
create or replace function public.daily_blitz_tallies(p_day date, p_answers text[] default null)
returns jsonb language plpgsql stable security definer set search_path = public, private, pg_temp as $$
begin
  perform private.daily_blitz_check(p_day, p_answers);
  if p_day > (now() at time zone 'utc')::date + 1 then raise exception 'bad_day'; end if;
  return private.daily_blitz_read(p_day, p_answers);
end $$;
revoke all on function public.daily_blitz_tallies(date, text[]) from public;
grant execute on function public.daily_blitz_tallies(date, text[]) to anon, authenticated;

-- CHECK (optional, after running): select public.daily_blitz_tallies(current_date);
--   -> {"day": "...", "plays": 0, "prompts": [{"mine": null, "top": []}, ... x6]}
