-- 090_living_bots.sql - the board bots LIVE again (Andy nov13: "are the ones moving on the leaderboard actual players?
-- ... we need more behavior like this for bots as well (to mimic actual hype)"). Needs 041 (profiles.is_bot) and 043.
--
-- WHY: 043 drifts a bot only inside a window that opens 2026-10-14 and closes 14-74 days later, and the later seeds were
-- picked with their windows already over. Measured nov14 against prod: 115 of 2,848 bots move at all in the next 24 h;
-- the rest are FROZEN, so nearly everything that moves on the board is a real player.
--
-- WHAT THIS DOES (nothing is written to profiles, so THIS WEEK and its gem prizes still never see a bot move):
--   1. private.bot_anchor - each bot's START: the level / rebirths the board shows for it the moment this file runs (043's
--      own number), so nothing jumps when it lands. A bot seeded later starts from its own row at its created_at.
--   2. public.lb_bot_live(...) - pure arithmetic on the bot's id and the clock (hashtext, like 043; no loop over days):
--        * its own pace: ~55% casual (2-8 levels a play day), ~25% regulars (8-18), ~13% grinders (18-32), ~7% bingers
--          (26-40, but only 1-2 days in a 9-20 day cycle). Never faster than a real player at the top (~43 levels a day);
--        * a play rhythm: a cycle of N days with some play days in it, at its own phase - idle stretches, then binges;
--        * a session: it plays at its own hour of the day for 1-4 hours, so its level climbs DURING that session - no
--          bot jumps at midnight and no two bots move in lockstep;
--        * it slows down the longer it plays (a log curve), and ~40% go quiet for good 7-120 days in;
--        * rebirths at the real gate (LV 15 + 18 x R) after its own short hesitation, never more often than a player can.
--   3. public.leaderboard_s2 - the same columns and order as 043, with the bot's live numbers, and ONE fairness rule:
--      a bot never passes a REAL player who has played in the last 3 days. It catches up to them and stays a few levels
--      behind (a rival on their heels); once that player is away for 3 days the bot may pass, as a real player would.
--
-- Names never change. Stars (ascension) never change for a bot. Leagues are drawn from the board rank in the browser, so
-- a bot holds a league place like anyone; no league pays anything. THIS WEEK (024) and its gem prizes (034) read the
-- profiles rows, which bots never write, so a bot never takes a weekly prize from a real player.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run (a re-run keeps every bot's start).

do $$
begin
  if to_regclass('public.leaderboard_s2') is null then raise exception '090 needs 022 + 043 (public.leaderboard_s2)'; end if;
  if to_regprocedure('public.lb_bot_drift(uuid,integer,integer)') is null then raise exception '090 needs 043 (public.lb_bot_drift)'; end if;
end $$;

-- 1. every bot's start: what the board shows for it right now (a re-run keeps the first one)
create table if not exists private.bot_anchor (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  level integer not null,
  rebirths integer not null,
  at timestamptz not null default now()
);
revoke all on private.bot_anchor from public;
revoke all on private.bot_anchor from anon, authenticated;

insert into private.bot_anchor (profile_id, level, rebirths, at)
select p.id, d.level, d.rebirths, now()
  from public.profiles p
  cross join lateral public.lb_bot_drift(p.id, p.level, p.rebirths) d
 where p.is_bot
on conflict (profile_id) do nothing;

-- 2. a bot's live level / rebirths at `at`, from its start (`since`, base_level, base_rb). Pure: same inputs, same answer.
create or replace function public.lb_bot_live(bot uuid, base_level int, base_rb int, since timestamptz, at timestamptz,
                                              out level int, out rebirths int)
language plpgsql immutable
set search_path = ''
as $fn$
declare
  id text := bot::text;
  cls int := abs(hashtext(id || ':cls')) % 100;
  rate numeric;          -- levels on a full play day
  per int;               -- the play cycle, in days
  play int;              -- play days in each cycle
  ph int;                -- where in its cycle it started
  slow numeric := 15 + abs(hashtext(id || ':slow')) % 46;   -- active days to tire (the log curve's scale)
  hr numeric := abs(hashtext(id || ':hr')) % 24;            -- its session's start hour (UTC)
  len numeric := 1 + abs(hashtext(id || ':len')) % 4;       -- its session's length, hours
  lag int := abs(hashtext(id || ':lag')) % 10;              -- levels past a gate before it rebirths
  career numeric;        -- days until it goes quiet for good (null = never)
  x numeric;             -- days since its first session after `since`
  n int;
  fr numeric;
  full_days numeric;
  today numeric;
  a numeric;             -- active days played so far (fractional during a session)
  lv numeric;
  cand int;
begin
  if cls < 55 then
    rate := 2 + abs(hashtext(id || ':r')) % 7;
    per := 4 + abs(hashtext(id || ':p')) % 7;
    play := 1 + abs(hashtext(id || ':k')) % greatest(1, per / 2);
  elsif cls < 80 then
    rate := 8 + abs(hashtext(id || ':r')) % 11;
    per := 3 + abs(hashtext(id || ':p')) % 5;
    play := greatest(1, per - 1 - abs(hashtext(id || ':k')) % 2);
  elsif cls < 93 then
    rate := 18 + abs(hashtext(id || ':r')) % 15;
    per := 7;
    play := 5 + abs(hashtext(id || ':k')) % 3;
  else
    rate := 26 + abs(hashtext(id || ':r')) % 15;
    per := 9 + abs(hashtext(id || ':p')) % 12;
    play := 1 + abs(hashtext(id || ':k')) % 2;
  end if;
  ph := abs(hashtext(id || ':ph')) % per;
  career := case when abs(hashtext(id || ':quit')) % 100 < 40 then 7 + abs(hashtext(id || ':cd')) % 114 else null end;

  x := extract(epoch from (at - since)) / 86400.0 - hr / 24.0;
  if career is not null then x := least(x, career); end if;
  if x <= 0 then
    a := 0;
  else
    n := floor(x)::int;
    fr := x - n;
    -- play days among days 0 .. n-1 of its cycle (shifted by its phase), then today's session so far
    full_days := (floor((n + ph)::numeric / per) * play + least((n + ph) % per, play))
               - (floor(ph::numeric / per) * play + least(ph % per, play));
    today := case when (n + ph) % per < play then least(1, fr * 24 / len) else 0 end;
    a := full_days + today;
  end if;

  lv := base_level + floor(rate * slow * ln(1 + a / slow));
  level := greatest(base_level, lv::int);
  -- rebirths: one for every gate (LV 15 + 18 x R, plus its own hesitation) it climbs past AFTER its start - so nothing
  -- jumps when this lands (043 let some bots sit past a gate), and never more than one rebirth per 18 levels gained
  cand := (case when level < 15 + lag then 0 else floor((level - 15 - lag) / 18.0)::int + 1 end)
        - (case when base_level < 15 + lag then 0 else floor((base_level - 15 - lag) / 18.0)::int + 1 end);
  rebirths := base_rb + greatest(0, cand);
end
$fn$;

-- in PUBLIC on purpose, like 043's lb_bot_drift: the board's readers evaluate it through the view, and it is pure
-- arithmetic on numbers the board already shows (it reads no table)
grant execute on function public.lb_bot_live(uuid, int, int, timestamptz, timestamptz) to anon, authenticated;

-- 3. the board: 043's view - the SAME columns in the same order (so create or replace keeps anything built on it) - with
-- the live numbers and the fairness rule
create or replace view public.leaderboard_s2 with (security_invoker = false) as
  with s1 as (
    select s.profile_id,
           row_number() over (order by s.rebirths desc, s.level desc, s.lifetime_words desc, p.created_at asc) as s1_rank
      from public.season1_snapshot s
      join public.profiles p on p.id = s.profile_id
  ),
  b0 as (
    select p.id, p.username, p.lifetime_words, p.lifetime_letters, p.wins_per_word, p.econ, p.stars, p.created_at,
           coalesce(p.is_bot, false) as is_bot, p.level as p_level, p.rebirths as p_rebirths,
           coalesce(an.level, p.level) as b_lv, coalesce(an.rebirths, p.rebirths) as b_rb, coalesce(an.at, p.created_at) as b_at
      from public.profiles p
      left join private.bot_anchor an on an.profile_id = p.id
     where p.econ = 13
  ),
  -- every bot's START and every REAL player who played in the last 3 days on one line, best first: a bot's ceiling is the
  -- lowest real player at or above its start (a tie counts) - the running min of the real rows above it. One sort for
  -- the whole board, and a running frame (unbounded preceding) Postgres keeps incrementally, so it stays linear.
  -- A bot never passes that player; the real player's own place stays honest.
  line as (
    select b0.id, b0.stars, b0.b_rb as rb, b0.b_lv as lv, 0 as is_real from b0 where b0.is_bot
    union all
    select null, p.stars, p.rebirths, p.level, 1
      from public.profiles p
     where not coalesce(p.is_bot, false) and p.econ = 13 and p.updated_at > now() - interval '3 days'
  ),
  ceil as (
    select line.id,
           min(case when line.is_real = 1 then array[line.stars, line.rb, line.lv] end)
             over (order by line.stars desc, line.rb desc, line.lv desc, line.is_real desc rows between unbounded preceding and current row) as c
      from line
  ),
  b1 as (
    select b0.*, l.level as l_lv, l.rebirths as l_rb, c.c[2] as c_rb, c.c[3] as c_lv, c.c[1] as c_stars
      from b0
      left join lateral public.lb_bot_live(b0.id, b0.b_lv, b0.b_rb, b0.b_at, now()) l on b0.is_bot
      left join ceil c on c.id = b0.id
  ),
  b2 as (
    select b1.*,
           -- caught up with that real player: stay a few levels behind them - or, when they only just rebirthed (LV 1-6
           -- leaves no room under them), one rebirth behind at the bot's own level. Never below the bot's own start.
           (b1.is_bot and b1.c_stars = b1.stars and (b1.l_rb, b1.l_lv) >= (b1.c_rb, b1.c_lv)) as held,
           (b1.c_lv - 1 - abs(hashtext(b1.id::text || ':hold')) % 6) as under_lv
      from b1
  ),
  b3 as (
    select b2.*,
           case when b2.under_lv >= 1 then b2.c_rb else b2.c_rb - 1 end as hold_rb,
           case when b2.under_lv >= 1 then b2.under_lv else b2.l_lv end as hold_lv
      from b2
  ),
  b as (
    select b3.id, b3.username, b3.lifetime_words, b3.lifetime_letters, b3.wins_per_word, b3.econ, b3.stars, b3.created_at,
           case when not b3.is_bot then b3.p_level
                when b3.held and (b3.hold_rb, b3.hold_lv) > (b3.b_rb, b3.b_lv) then b3.hold_lv
                when b3.held then b3.b_lv
                else b3.l_lv end as level,
           case when not b3.is_bot then b3.p_rebirths
                when b3.held and (b3.hold_rb, b3.hold_lv) > (b3.b_rb, b3.b_lv) then b3.hold_rb
                when b3.held then b3.b_rb
                else b3.l_rb end as rebirths
      from b3
  )
  select row_number() over (order by b.stars desc, b.rebirths desc, b.level desc, b.lifetime_words desc,
                                     s1.s1_rank asc nulls last, b.created_at asc) as rank,
         b.id, b.username, b.level, b.rebirths, b.lifetime_words, b.lifetime_letters, b.wins_per_word, b.econ, b.stars,
         (b.rebirths > 0 or b.level > 1 or b.lifetime_words > 0 or b.stars > 0) as earned,
         s1.s1_rank
    from b
    left join s1 on s1.profile_id = b.id;

grant select on public.leaderboard_s2 to anon, authenticated;

notify pgrst, 'reload schema';

-- CHECK (how many bots moved in the last hour - run it twice an hour apart and compare):
-- select count(*) filter (where p.is_bot) as bots, count(*) filter (where p.is_bot and (b.level, b.rebirths) <> (a.level, a.rebirths)) as moved_since_090
--   from public.leaderboard_s2 b join public.profiles p on p.id = b.id left join private.bot_anchor a on a.profile_id = b.id;
