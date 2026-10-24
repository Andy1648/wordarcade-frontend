-- 065_chaser_showcase.sql - 064's 3 chasers get a believable profile card (Andy oct24 "their gears are empty ... and i
-- want to change their usernames"). Needs 064. Shaped after the real R43-R72 rows on the board:
--   * NEW NAMES (pass nameFilter, free on the board): calmVole -> Tobias_R (R38), YakGang -> jessxo (R35),
--     xspunkymarmotx -> Kaito_ (R31)
--   * WORDS: real R40s show 1-5k season words; 064's 17-21k stood out, so ~2-3k
--   * SHOWCASE: two worn gears (legendary / mythic, no SECRET, no UNLISTED), 24-31 of 48 found, POWER 38-44, badges,
--     an OBSCURE signature word, a best chain, a hero (one has none, like half the real top rows). No bio, no title.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run.

update public.profiles set username = 'Tobias_R', lifetime_words = 2860, lifetime_letters = 18130 where is_bot and username = 'calmVole';
update public.profiles set username = 'jessxo', lifetime_words = 2410, lifetime_letters = 15190 where is_bot and username = 'YakGang';
update public.profiles set username = 'Kaito_', lifetime_words = 1930, lifetime_letters = 12350 where is_bot and username = 'xspunkymarmotx';

insert into public.profile_showcase as s
  (profile_id, gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power, badges, sig_word, sig_band, best_chain, title, hero, updated_at)
select p.id, v.gear1, v.gear2, v.base_wins, v.wpw, v.found, 48, v.power, v.badges::jsonb, v.sig_word, 'OBSCURE', v.best_chain, null, v.hero, now()
  from (values
    ('Tobias_R', 'mk-chronos', 'mk-leviathan', 27, 4.1e29, 31, 44, '{"reb": 2, "roll": 3, "type": 2, "chain": 3, "index": 2, "power": 4}', 'ephemeral', 41, 'hollow'),
    ('jessxo', 'mk-kraken', 'mk-eclipse', 22, 8.7e27, 27, 41, '{"reb": 2, "bots": 1, "roll": 2, "type": 2, "chain": 2, "index": 2, "power": 3}', 'quintessential', 23, 'lexi'),
    ('Kaito_', 'mk-thunderclap', 'mk-jackpot', 19, 2.3e26, 24, 38, '{"reb": 2, "roll": 2, "type": 2, "chain": 3, "index": 2, "power": 3}', 'labyrinth', 33, null)
  ) as v(username, gear1, gear2, base_wins, wpw, found, power, badges, sig_word, best_chain, hero)
  join public.profiles p on p.username = v.username and p.is_bot
on conflict (profile_id) do update set
  gear1 = excluded.gear1, gear2 = excluded.gear2, base_wins = excluded.base_wins, wins_per_word = excluded.wins_per_word,
  gears_found = excluded.gears_found, gears_total = excluded.gears_total, power = excluded.power, badges = excluded.badges,
  sig_word = excluded.sig_word, sig_band = excluded.sig_band, best_chain = excluded.best_chain, title = null,
  hero = excluded.hero, updated_at = now();

-- CHECK: select p.username, p.rebirths, s.gear1, s.gear2, s.hero from public.profiles p join public.profile_showcase s on s.profile_id = p.id where p.is_bot;
