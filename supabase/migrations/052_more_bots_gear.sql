-- 052_more_bots_gear.sql - 200 MORE BOARD BOTS + GEAR ON THE TOP-100 BOTS (Andy oct16 "make 200 more bots - dont make
-- stupid names that are too obvious, also attach gear as well for the applicable ones in top 100"). Needs 041 + 043 + 046.
-- Names read like real handles (no xNamex, few years); stats come from a hash of the name, so a re-run is identical.
-- Same spread as 045 (about half R0, thinning to R7, never above). The gear part gives every bot that is in the board's
-- TOP 100 right now a showcase (worn gear, 2nd gear from R5, stats, a few badges) — never overwrites a real row.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE thing > Run. Safe to re-run.
-- REMOVE all bots: delete from public.profiles where is_bot;   (their showcase rows go with them)

with names(n) as (select unnest(array[
  'junspells', 'marcusplays', 'itscaleb', 'mangofizz', 'jm01', 'jr20', 'rileypickle', 'Sundaez861', 'Glitch_paper', 'itszoe',
  'pine_moth', 'sofiathepickle', 'waffle_pickle', 'realmarcus', 'diego', 'minjitheneon', 'Tinysofia', 'finncrisp', 'tylernaps', 'itsezra',
  'Lilsofia', 'eo24', 'ella', 'wafflez249', 'aidentheramen', 'em21', 'socksbasil', 'jun', 'jaderuns', 'sudo_mateo',
  'tiredorbit', 'itsharper', 'Noranaps', 'tessj79', 'basilmoth', 'honey474', 'am09', 'kenjii70', 'sudo_tyler', 'asherie',
  'tinyriley', 'Omarwrites', 'lucky_socks', 'gretathebiscuit', 'zoe', 'finnthecomet', 'avaie', 'paperecho', 'dg18', 'lilaiden',
  'andrethelowkey', 'rg27', 'eli_f32', 'ivythevelvet', 'sudo_ruby', 'sleepy_lowkey', 'diegoz', 'tangled463', 'theomar', 'mxrcus',
  'berryloud', 'jw24', 'Imxni', 'Spare_velvet', 'cobalt_plum', 'jxydenzz', 'honey315', 'devo', 'thejosh', 'orbit_927',
  'Hanathejuniper', 'quiet_neon', 'itsquinn', 'drizzlecrisp', 'jxlen', 'bignoah', 'sleepy205', 'justezra', 'leahthemarble', 'ryanmint',
  'omartypes', 'dylxnz', 'justyusuf', 'static_tired', 'mt27', 'lildiego', 'realnoah', 'sagenaps', 'mothbasil', 'tinychloe',
  'picklequiet', 'jm24', 'rubydraws', 'Kj05', 'norafizz', 'Ro14', 'ellaruns', 'mxson', 'milocodes', 'mothtoast',
  'crisp_614', 'frogz539', 'frog626', 'socks_biscuit', 'toast_331', 'Diegotypes', 'norathebrick', 'fe28', 'tobiaswaffle', 'glitch_frog',
  'mayathebasil', 'kenji_m', 'gretam88', 'emma_a8', 'marble_mint', 'mj15', 'acorn_juniper', 'amarareads', 'biscuitpine', 'jade_s',
  'yukiruns', 'Ellacodes', 'benjispare', 'pine_818', 'kenjim', 'zs02', 'zaratired', 'liljun', 'itsimani', 'waffle_946',
  'josho', 'itsemma', 'notemma', 'velvet_loud', 'sudo_ella', 'quietecho', 'sleepyjuniper', 'paper_orbit', 'static_196', 'imanispells',
  'benjiplays', 'neon620', 'plumjuniper', 'mint729', 'ivyie', 'Sleepytangled', 'brick_echo', 'lowkeyz452', 'norathemarble', 'ln16',
  'weiz', 'milo', 'minjiwrites', 'acorn_ember', 'Kylenaps', 'suddenneon', 're22', 'sundaejuniper', 'gt04', 'realmateo',
  'papermoth', 'sofiatheacorn', 'emmaz', 'ava_l', 'paperfrog', 'imaniie', 'ember_sundae', 'itsdylan', 'sundaepine', 'marble484',
  'natenaps', 'itstheo', 'Lowkeylily', 'zoeie', 'omar_d', 'Sudo_gavin', 'cb27', 'mangowaffle', 'aj17', 'Lowkey854',
  'Harpertheramen', 'Crisp_tired', 'amaray34', 'omarmarble', 'notzoe', 'neonpickle', 'bigwei', 'Imanithewaffle', 'sageie', 'mayal21',
  'jn19', 'priyatheloud', 'ivy', 'mateopine', 'Tess_c', 'basil_berry', 'ethanwrites', 'sleepylemon', 'avaplays', 'pickle_pine'
])),
h as (
  select n,
         ('x' || substr(md5(n), 1, 7))::bit(28)::int / 268435456.0 as u1,
         ('x' || substr(md5(n), 8, 7))::bit(28)::int / 268435456.0 as u2,
         ('x' || substr(md5(n), 15, 7))::bit(28)::int / 268435456.0 as u3
    from names
),
s as (
  select n, u3,
         case when u1 < .46 then 0 when u1 < .68 then 1 when u1 < .82 then 2 when u1 < .91 then 3
              when u1 < .96 then 4 when u1 < .985 then 5 when u1 < .995 then 6 else 7 end as rb,
         2 + floor(u2 * 68)::int as lv
    from h
)
insert into public.profiles (username, level, rebirths, lifetime_words, lifetime_letters, econ, stars, is_bot, created_at)
select n, lv, rb, lv * (9 + rb * 2) + floor(u3 * 40)::int, (lv * (9 + rb * 2) + floor(u3 * 40)::int) * 6, 13, 0, true,
       now() - make_interval(days => floor(u3 * 25)::int, hours => floor(u3 * 997)::int % 24)
  from s
 where not exists (select 1 from public.profiles p where lower(p.username) = lower(s.n));

-- GEAR for the bots in the TOP 100 (rank from the live board, drift included)
with top as (
  select b.id, b.rank, b.rebirths,
         ('x' || substr(md5(b.id::text), 1, 7))::bit(28)::int / 268435456.0 as u1,
         ('x' || substr(md5(b.id::text), 8, 7))::bit(28)::int / 268435456.0 as u2,
         ('x' || substr(md5(b.id::text), 15, 7))::bit(28)::int / 268435456.0 as u3
    from public.leaderboard_s2 b
    join public.profiles p on p.id = b.id
   where p.is_bot and b.rank <= 100
),
pick as (
  select t.*,
         case when t.rank <= 10 and t.u1 < .25 then 'mythic' when t.rank <= 10 then 'legendary'
              when t.rank <= 40 and t.u1 < .45 then 'legendary' when t.rank <= 40 then 'epic'
              when t.u1 < .5 then 'epic' else 'rare' end as tier
    from top t
),
pool(tier, ids) as (values
  ('rare', array['mk-detonator','mk-cyclone','mk-scholar','mk-ouroboros','mk-tinder','mk-slipstream','mk-smith','mk-phoenix','mk-metronome','mk-hotwire','mk-grapple','mk-sparkplug']),
  ('epic', array['mk-pyro','mk-nova','mk-golem','mk-brainstorm','mk-flashpoint','mk-voltage','mk-talisman']),
  ('legendary', array['mk-leviathan','mk-eclipse','mk-headmaster','mk-thunderclap','mk-jackpot']),
  ('mythic', array['mk-singularity','mk-kraken','mk-hydra'])
)
insert into public.profile_showcase as sc (profile_id, gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power, badges, best_chain, updated_at)
select k.id,
       g.ids[1 + floor(k.u2 * array_length(g.ids, 1))::int],
       case when k.rebirths >= 5 then e.ids[1 + floor(k.u3 * array_length(e.ids, 1))::int] end,
       20 + k.rebirths * 18 + floor(k.u3 * 30)::int,
       round(((20 + k.rebirths * 18 + floor(k.u3 * 30)::int) * power(1 + k.rebirths, 2.2))::numeric, 1),
       least(28, 5 + k.rebirths * 3 + floor(k.u2 * 6)::int), 28,
       least(30, 1 + k.rebirths + floor(k.u1 * 4)::int),
       jsonb_build_object('type', least(5, 1 + k.rebirths / 2), 'win', least(5, 1 + floor(k.u2 * 3)::int))
         || case when k.rebirths >= 1 then jsonb_build_object('reb', least(5, k.rebirths)) else '{}'::jsonb end,
       3 + floor(k.u3 * (8 + k.rebirths * 4))::int,
       now()
  from pick k
  join pool g on g.tier = k.tier
  join pool e on e.tier = 'epic'
on conflict (profile_id) do nothing;

-- CHECK: select count(*) from public.profiles where is_bot;   (450)
-- CHECK: select b.rank, b.username, s.gear1, s.gear2 from public.leaderboard_s2 b join public.profile_showcase s on s.profile_id = b.id join public.profiles p on p.id = b.id where p.is_bot order by b.rank limit 20;
