-- 087_reject_log_rooms.sql - THE REJECT LOG now covers WORD BOMB and CATEGORY BLITZ too (Andy nov6: "more answers").
--   * mode gains 'word-bomb' and 'blitz'.
--   * ctx: the Blitz category the answer was refused in ('' for every other mode). A Blitz word means nothing without it.
--   * word may be up to 3 words for Blitz (letters and single spaces only).
-- STILL ANONYMOUS: no player id, name, secret or session. Free-typed Blitz answers can hold anything a kid types, so read
-- the rows before adding a word; nothing here is ever shown in the game on its own.
-- ORDER: after 084. WRITE-ONLY: Claude never runs migrations. Run once in the Supabase SQL editor. Safe to re-run. ASCII only.

alter table public.reject_log drop constraint if exists reject_log_word_check;
alter table public.reject_log drop constraint if exists reject_log_mode_check;
alter table public.reject_log drop constraint if exists reject_log_ctx_check;
alter table public.reject_log drop constraint if exists reject_log_pkey;
alter table public.reject_log add column if not exists ctx text not null default '';
alter table public.reject_log add constraint reject_log_word_check check (word ~ '^[a-z]{2,15}( [a-z]{1,15}){0,2}$');
alter table public.reject_log add constraint reject_log_mode_check check (mode in ('fuse', 'chain', 'word-bomb', 'blitz'));
alter table public.reject_log add constraint reject_log_ctx_check check (length(ctx) <= 80);
alter table public.reject_log add primary key (word, mode, ctx, day);

drop function if exists public.log_rejects(text, text[]);
create or replace function public.log_rejects(p_mode text, p_words text[], p_ctx text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w text;
  c text := case when p_mode = 'blitz' then left(coalesce(p_ctx, ''), 80) else '' end;
begin
  if p_mode is null or p_mode not in ('fuse', 'chain', 'word-bomb', 'blitz') or p_words is null then
    return;
  end if;
  if p_mode = 'blitz' and c = '' then
    return;
  end if;
  -- a hard daily ceiling, so a misbehaving client can never grow the table without bound
  if (select count(*) from reject_log where day = current_date) >= 20000 then
    return;
  end if;
  foreach w in array p_words[1:20] loop
    w := lower(trim(w));
    if (p_mode = 'blitz' and w ~ '^[a-z]{2,15}( [a-z]{1,15}){0,2}$') or (p_mode <> 'blitz' and w ~ '^[a-z]{2,15}$') then
      insert into reject_log (word, mode, ctx, day, n) values (w, p_mode, c, current_date, 1)
      on conflict (word, mode, ctx, day) do update set n = reject_log.n + 1;
    end if;
  end loop;
end;
$$;

revoke all on function public.log_rejects(text, text[], text) from public;
grant execute on function public.log_rejects(text, text[], text) to anon, authenticated;
