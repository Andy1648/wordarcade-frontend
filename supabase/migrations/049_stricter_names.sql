-- 049_stricter_names.sql — STRICTER USERNAMES (Andy oct15: "dick gets flagged but bigdick doesnt").
-- Mirrors src/leaderboard/nameFilter.js (ROOTS + ALLOW); nameVectors.js is the shared truth table.
--   * ROOTS gains the words once left out because innocent words contain them (dick, cock, cum, sex, anal, …).
--   * NEW kind 'allow': innocent words containing a root (dickens, peacock, document, essex, therapist, …). They are cut
--     out of the leet-decoded name BEFORE the root check; exact-term checks are unchanged.
-- Existing names are NOT touched (the trigger fires on insert/update only) — a new claim or rename is checked.
-- WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run.

alter table private.blocked_terms drop constraint if exists blocked_terms_kind_check;
alter table private.blocked_terms add constraint blocked_terms_kind_check check (kind in ('exact', 'root', 'cjk', 'allow'));

insert into private.blocked_terms (term, kind) values
  ('dick', 'root'),
  ('cock', 'root'),
  ('cum', 'root'),
  ('sex', 'root'),
  ('anal', 'root'),
  ('rape', 'root'),
  ('tits', 'root'),
  ('boob', 'root'),
  ('horny', 'root'),
  ('nude', 'root'),
  ('semen', 'root'),
  ('clit', 'root'),
  ('milf', 'root'),
  ('hentai', 'root'),
  ('orgasm', 'root'),
  ('boner', 'root'),
  ('nutsack', 'root'),
  ('ballsack', 'root'),
  ('scrotum', 'root'),
  ('butthole', 'root'),
  ('nsfw', 'root')
on conflict (term) do update set kind = excluded.kind;

insert into private.blocked_terms (term, kind) values
  ('dickens', 'allow'),
  ('dickinson', 'allow'),
  ('dickson', 'allow'),
  ('benedick', 'allow'),
  ('peacock', 'allow'),
  ('hancock', 'allow'),
  ('cockpit', 'allow'),
  ('cocktail', 'allow'),
  ('cockatoo', 'allow'),
  ('cockroach', 'allow'),
  ('cockney', 'allow'),
  ('cocky', 'allow'),
  ('cockle', 'allow'),
  ('hitchcock', 'allow'),
  ('woodcock', 'allow'),
  ('shuttlecock', 'allow'),
  ('babcock', 'allow'),
  ('gamecock', 'allow'),
  ('document', 'allow'),
  ('cucumber', 'allow'),
  ('circumstance', 'allow'),
  ('accumulat', 'allow'),
  ('cumulus', 'allow'),
  ('cumbria', 'allow'),
  ('cumberland', 'allow'),
  ('incumbent', 'allow'),
  ('succumb', 'allow'),
  ('essex', 'allow'),
  ('sussex', 'allow'),
  ('wessex', 'allow'),
  ('middlesex', 'allow'),
  ('sextant', 'allow'),
  ('sextet', 'allow'),
  ('sexton', 'allow'),
  ('unisex', 'allow'),
  ('canal', 'allow'),
  ('banal', 'allow'),
  ('analy', 'allow'),
  ('analog', 'allow'),
  ('grape', 'allow'),
  ('drape', 'allow'),
  ('scrape', 'allow'),
  ('trapeze', 'allow'),
  ('rapeseed', 'allow'),
  ('parapet', 'allow'),
  ('therapist', 'allow'),
  ('thorny', 'allow')
on conflict (term) do update set kind = excluded.kind;

-- the leet form with every ALLOW word cut out (stable: reads the table)
create or replace function public.name_cut_allowed(t text)
returns text language plpgsql stable security definer set search_path = private, public, pg_temp as $$
declare s text := public.name_leet(t); a text;
begin
  for a in select term from private.blocked_terms where kind = 'allow' order by term loop
    s := replace(s, a, '');
  end loop;
  return s;
end $$;

create or replace function public.username_is_clean(u text)
returns boolean language sql stable security definer set search_path = private, public, pg_temp as $$
  with c as (select public.name_cut_allowed(u) as cut)
  select not exists (
    select 1 from private.blocked_terms b, c
    where (b.kind = 'exact' and (b.term = public.name_leet(u)
                                 or b.term = regexp_replace(lower(coalesce(u, '')), '[^a-z]', '', 'g')))
       or (b.kind = 'root' and (position(b.term in c.cut) > 0
                                or position(b.term in regexp_replace(c.cut, '(.)\1+', '\1', 'g')) > 0))
       or (b.kind = 'cjk' and position(b.term in coalesce(u, '')) > 0)
  )
$$;
revoke execute on function public.username_is_clean(text) from public;
grant execute on function public.username_is_clean(text) to anon, authenticated;

notify pgrst, 'reload schema';
