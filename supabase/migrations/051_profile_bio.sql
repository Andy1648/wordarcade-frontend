-- 051_profile_bio.sql - PROFILE DESCRIPTION (Andy oct15 "word blog will be like a profile description that the user can
-- type in but censorship is needed there"). A player types up to 100 characters; the leaderboard's profile card shows it
-- where the SIGNATURE WORD used to be. Free text, so it is FILTERED HERE (the client's nameFilter.bioVerdict is only the
-- instant answer):
--   * no links (http, www., .com/.gg/..., discord gg)
--   * every WORD must pass public.username_is_clean (049: exact terms, roots, the ALLOW carve-outs) - per word, because
--     the whole run of letters would read "this exam" as "sex"; single letters in a row are joined ("f u c k")
--   * a few whole words that are innocent inside a name but not on their own (ass, hoe, tit ...) - client BIO_EXACT
--   * the CJK terms anywhere
-- A refused description is NOT stored (the old one stays) and is logged to private.bio_rejects for Andy:
--   select * from private.bio_rejects order by at desc;
-- Empty text clears it. One change per 5 s. Safe to re-run. ASCII only.

alter table public.profile_showcase add column if not exists bio text check (bio is null or length(bio) <= 100);
alter table public.profile_showcase add column if not exists bio_at timestamptz;

create table if not exists private.bio_rejects (
  id bigserial primary key,
  profile_id uuid,
  bio text,
  at timestamptz not null default now()
);

create or replace function public.bio_is_clean(t text)
returns boolean language plpgsql stable security definer set search_path = private, public, pg_temp as $$
declare s text := btrim(coalesce(t, '')); tok text; run text := ''; words text[] := '{}'; w text;
begin
  if length(s) = 0 or length(s) > 100 then return false; end if;
  if s ~* '(https?:|www\.|\.(com|net|org|gg|io|tv|ly|xyz|co)\M|discord\s*\.?\s*gg)' then return false; end if;
  if exists (select 1 from private.blocked_terms b where b.kind = 'cjk' and position(b.term in s) > 0) then return false; end if;
  for tok in select x from regexp_split_to_table(lower(s), '[^a-z0-9@$!]+') as x where x <> '' loop
    if length(tok) = 1 then run := run || tok;
    else
      if run <> '' then words := words || run; run := ''; end if;
      words := words || tok;
    end if;
  end loop;
  if run <> '' then words := words || run; end if;
  foreach w in array words loop
    if public.name_leet(w) = any (array['ass', 'asses', 'arse', 'hoe', 'hoes', 'tit', 'titty', 'titties', 'nig', 'spic',
                                        'pedo', 'thot', 'stfu', 'gtfo', 'kys']) then return false; end if;
    if not public.username_is_clean(w) then return false; end if;
  end loop;
  return true;
end $$;
revoke execute on function public.bio_is_clean(text) from public;
grant execute on function public.bio_is_clean(text) to anon, authenticated;

create or replace function public.lb_bio_set(p_secret text, p_bio text)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; b text := btrim(coalesce(p_bio, '')); last timestamptz;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('error', 'no_profile'); end if;
  select bio_at into last from public.profile_showcase where profile_id = pid;
  if last is not null and last > now() - interval '5 seconds' then return json_build_object('error', 'slow_down'); end if;
  if length(b) > 100 then return json_build_object('error', 'long'); end if;
  if length(b) > 0 and not public.bio_is_clean(b) then
    insert into private.bio_rejects (profile_id, bio) values (pid, left(b, 200));
    return json_build_object('error', 'blocked');
  end if;
  insert into public.profile_showcase as s (profile_id, bio, bio_at)
  values (pid, nullif(b, ''), now())
  on conflict (profile_id) do update set bio = excluded.bio, bio_at = now();
  return json_build_object('ok', true, 'v', 51);
end $$;
revoke all on function public.lb_bio_set(text, text) from public;
grant execute on function public.lb_bio_set(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
