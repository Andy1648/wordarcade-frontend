-- 082_reject_log.sql — THE REJECT LOG (nov4, Andy: "they need more … accepted words"). Which words FUSE / CHAIN reject as
-- "not in our word list", counted per (word, mode, day), so the accept lists grow from evidence (src/telemetry/rejectLog.js).
-- ANONYMOUS: no player id, name, secret or session is stored — only the word, the mode and the day.
-- Writes only through log_rejects (security definer); the table has RLS on and NO policies, so the anon key can neither
-- read nor write it directly. Read it from the dashboard (service role):
--   select word, mode, sum(n) as n from reject_log group by 1, 2 order by n desc limit 200;

create table if not exists public.reject_log (
  word text not null check (word ~ '^[a-z]{2,15}$'),
  mode text not null check (mode in ('fuse', 'chain')),
  day  date not null default current_date,
  n    int  not null default 1,
  primary key (word, mode, day)
);
alter table public.reject_log enable row level security;

create or replace function public.log_rejects(p_mode text, p_words text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w text;
begin
  if p_mode is null or p_mode not in ('fuse', 'chain') or p_words is null then
    return;
  end if;
  -- a hard daily ceiling, so a misbehaving client can never grow the table without bound
  if (select count(*) from reject_log where day = current_date) >= 20000 then
    return;
  end if;
  foreach w in array p_words[1:20] loop
    w := lower(trim(w));
    if w ~ '^[a-z]{2,15}$' then
      insert into reject_log (word, mode, day, n) values (w, p_mode, current_date, 1)
      on conflict (word, mode, day) do update set n = reject_log.n + 1;
    end if;
  end loop;
end;
$$;

revoke all on function public.log_rejects(text, text[]) from public;
grant execute on function public.log_rejects(text, text[]) to anon, authenticated;
