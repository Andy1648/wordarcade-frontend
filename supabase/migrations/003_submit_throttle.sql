-- 003_submit_throttle.sql — the 5 s submit throttle keyed off its OWN timestamp.
-- 001 compared against updated_at, which lb_claim also sets, so the first stats push right after
-- claiming a name was silently dropped (found by the REST probe: board showed LV1 after a LV42 push).
alter table public.profiles add column if not exists submitted_at timestamptz;

create or replace function public.lb_submit(p_secret text, p_level integer, p_rebirths integer,
                                            p_lifetime_words bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile' using errcode = 'no_data_found'; end if;
  update public.profiles
     set level = greatest(1, least(p_level, 100000)),
         rebirths = greatest(0, least(p_rebirths, 1000)),
         lifetime_words = greatest(0, least(p_lifetime_words, 100000000)),
         wins_per_word = greatest(0, least(round(p_wins_per_word, 1), 1000000000)),
         submitted_at = now(),
         updated_at = now()
   where id = pid and (submitted_at is null or submitted_at < now() - interval '5 seconds');
end $$;
