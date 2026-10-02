-- 005_letters_cjk.sql — STEP 51 (Andy oct2): the leaderboard's main stat is LIFETIME LETTERS TYPED,
-- rebirth shows as the name's colour (client), and Chinese (CJK) usernames are allowed, with a
-- Chinese profanity list in the SAME DB-enforced filter.
--
-- ADDITIVE and safe to re-run. The client feature-detects this migration through public.lb_caps():
-- before it is applied the game keeps using lb_submit / lifetime_words / ASCII names exactly as now.

-- ---- the stat ------------------------------------------------------------------------------------
alter table public.profiles add column if not exists lifetime_letters bigint not null default 0;
do $$ begin
  alter table public.profiles add constraint profiles_letters_range check (lifetime_letters between 0 and 2000000000);
exception when duplicate_object then null; end $$;

-- ---- CJK names ------------------------------------------------------------------------------------
-- ASCII names keep 3-16 [A-Za-z0-9_]; a name with any CJK ideograph may be 2-12 chars of CJK + ASCII.
alter table public.profiles drop constraint if exists profiles_username_shape;
alter table public.profiles add constraint profiles_username_shape check (
  username ~ '^[A-Za-z0-9_]{3,16}$'
  or (username ~ '^[A-Za-z0-9_㐀-䶿一-鿿]{2,12}$' and username ~ '[㐀-䶿一-鿿]')
);

-- Chinese terms are matched as SUBSTRINGS of the raw name (no leet map applies to ideographs).
alter table private.blocked_terms drop constraint if exists blocked_terms_kind_check;
alter table private.blocked_terms add constraint blocked_terms_kind_check check (kind in ('exact', 'root', 'cjk'));
insert into private.blocked_terms (term, kind) values
  ('操你', 'cjk'), ('肏', 'cjk'), ('傻逼', 'cjk'), ('傻屄', 'cjk'), ('煞笔', 'cjk'), ('沙比', 'cjk'),
  ('妈的', 'cjk'), ('他妈', 'cjk'), ('你妈', 'cjk'), ('尼玛', 'cjk'), ('草泥马', 'cjk'), ('日你', 'cjk'),
  ('屌', 'cjk'), ('鸡巴', 'cjk'), ('几把', 'cjk'), ('屄', 'cjk'), ('逼', 'cjk'), ('婊子', 'cjk'),
  ('贱人', 'cjk'), ('贱货', 'cjk'), ('王八蛋', 'cjk'), ('狗日', 'cjk'), ('狗娘', 'cjk'), ('杂种', 'cjk'),
  ('混蛋', 'cjk'), ('滚蛋', 'cjk'), ('去死', 'cjk'), ('死全家', 'cjk'), ('脑残', 'cjk'), ('弱智', 'cjk'),
  ('妓女', 'cjk'), ('卖淫', 'cjk'), ('色情', 'cjk'), ('淫', 'cjk'), ('强奸', 'cjk'), ('轮奸', 'cjk'),
  ('阴茎', 'cjk'), ('阴道', 'cjk'), ('做爱', 'cjk'), ('性交', 'cjk'), ('黑鬼', 'cjk'), ('支那', 'cjk'),
  ('小日本', 'cjk'), ('鬼子', 'cjk'), ('棒子', 'cjk'), ('阿三', 'cjk'), ('基佬', 'cjk'), ('死基', 'cjk'),
  ('纳粹', 'cjk'), ('希特勒', 'cjk'), ('恐怖分子', 'cjk'), ('自杀', 'cjk'), ('毒品', 'cjk'), ('冰毒', 'cjk')
on conflict (term) do update set kind = excluded.kind;

create or replace function public.username_is_clean(u text)
returns boolean language sql stable security definer set search_path = private, public, pg_temp as $$
  select not exists (
    select 1 from private.blocked_terms b
    where (b.kind = 'exact' and (b.term = public.name_leet(u)
                                 or b.term = regexp_replace(lower(coalesce(u, '')), '[^a-z]', '', 'g')))
       or (b.kind = 'root' and (position(b.term in public.name_leet(u)) > 0
                                or position(b.term in public.name_squash(u)) > 0))
       or (b.kind = 'cjk' and position(b.term in coalesce(u, '')) > 0)
  )
$$;

create or replace function public.lb_name_status(p_username text)
returns text language sql stable security definer set search_path = public, private, pg_temp as $$
  select case
    when not (coalesce(p_username, '') ~ '^[A-Za-z0-9_]{3,16}$'
              or (coalesce(p_username, '') ~ '^[A-Za-z0-9_㐀-䶿一-鿿]{2,12}$' and p_username ~ '[㐀-䶿一-鿿]')) then 'shape'
    when not public.username_is_clean(p_username) then 'blocked'
    when exists (select 1 from public.profiles where lower(username) = lower(p_username)) then 'taken'
    else 'ok' end
$$;

-- ---- submit v2: + letters (same honest-play shape as v1, letters can't outrun a human) ------------
create or replace function public.lb_submit2(p_secret text, p_level integer, p_rebirths integer,
                                             p_lifetime_words bigint, p_lifetime_letters bigint, p_wins_per_word numeric)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; old public.profiles; lv integer; rb integer; w bigint; l bigint;
begin
  pid := private.profile_for_secret(p_secret);
  if pid is null then raise exception 'no_profile'; end if;
  select * into old from public.profiles where id = pid for update;
  if old.submitted_at is not null and old.submitted_at >= now() - interval '5 seconds' then
    return; -- throttled
  end if;
  lv := greatest(1, least(coalesce(p_level, 1), 100000));
  rb := greatest(0, least(coalesce(p_rebirths, 0), 1000));
  w := greatest(0, least(coalesce(p_lifetime_words, 0), 100000000));
  l := greatest(0, least(coalesce(p_lifetime_letters, 0), 2000000000));
  if old.submitted_at is not null then
    if rb < old.rebirths or w < old.lifetime_words or l < old.lifetime_letters then return; end if;
    if lv < old.level and rb = old.rebirths then return; end if;
    if w - old.lifetime_words > 20 * greatest(1, extract(epoch from (now() - old.submitted_at))) then return; end if;
    if l - old.lifetime_letters > 150 * greatest(1, extract(epoch from (now() - old.submitted_at))) then return; end if;
  end if;
  update public.profiles
     set level = lv, rebirths = rb, lifetime_words = w, lifetime_letters = l,
         wins_per_word = greatest(0, least(round(coalesce(p_wins_per_word, 0), 1), 1000000000)),
         submitted_at = now(), updated_at = now()
   where id = pid;
end $$;
revoke all on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) from public;
grant execute on function public.lb_submit2(text, integer, integer, bigint, bigint, numeric) to anon, authenticated;

-- ---- the board: LETTERS first ----------------------------------------------------------------------
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker = true) as
  select row_number() over (order by lifetime_letters desc, level desc, rebirths desc, created_at asc) as rank,
         id, username, level, rebirths, lifetime_words, lifetime_letters, wins_per_word
    from public.profiles;
grant select on public.leaderboard to anon, authenticated;

-- ---- what this DB can do (the client's feature probe) ---------------------------------------------
create or replace function public.lb_caps()
returns json language sql stable as $$ select json_build_object('letters', true, 'cjk', true) $$;
grant execute on function public.lb_caps() to anon, authenticated;
