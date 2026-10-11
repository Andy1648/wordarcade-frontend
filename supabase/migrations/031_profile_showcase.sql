-- 031_profile_showcase.sql — LEADERBOARD PROFILES (Andy oct10: "click anyone on leaderboard to see their stats (only
-- fun ones like gear(s), base, etc.)").
--
-- One row per profile with what its owner's game last reported: the worn gear(s), BASE wins / word, wins / word,
-- gears found and the POWER tier. Cosmetic only: nothing ranks or pays by it, so it is self-reported (like a
-- profile's username) and only SHAPE-checked here. Anyone can READ it (the board is public); only lb_showcase_set,
-- with the owner's secret, writes it.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

create table if not exists public.profile_showcase (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  gear1 text check (gear1 is null or gear1 ~ '^mk-[a-z0-9-]{1,24}$'),
  gear2 text check (gear2 is null or gear2 ~ '^mk-[a-z0-9-]{1,24}$'),
  base_wins numeric check (base_wins is null or (base_wins >= 0 and base_wins <= 1e12)),
  wins_per_word double precision check (wins_per_word is null or (wins_per_word >= 0 and wins_per_word <= 1e300)),
  gears_found integer check (gears_found is null or gears_found between 0 and 500),
  gears_total integer check (gears_total is null or gears_total between 0 and 500),
  power integer check (power is null or power between 0 and 1000),
  updated_at timestamptz not null default now()
);
alter table public.profile_showcase enable row level security;
drop policy if exists profile_showcase_read on public.profile_showcase;
create policy profile_showcase_read on public.profile_showcase for select to anon, authenticated using (true);
revoke insert, update, delete on public.profile_showcase from anon, authenticated;
grant select on public.profile_showcase to anon, authenticated;

-- Write the caller's showcase. p_show = { gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power };
-- a missing / bad field is stored as null (the card shows a dash), never an error — a stale client must not break.
create or replace function public.lb_showcase_set(p_secret text, p_show jsonb)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; g1 text; g2 text; bw numeric; wpw double precision; gf integer; gt integer; pw integer;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('error', 'no_profile'); end if;
  if p_show is null or jsonb_typeof(p_show) <> 'object' or length(p_show::text) > 2000 then
    return json_build_object('error', 'bad_show');
  end if;
  g1 := p_show->>'gear1'; if g1 is not null and g1 !~ '^mk-[a-z0-9-]{1,24}$' then g1 := null; end if;
  g2 := p_show->>'gear2'; if g2 is not null and g2 !~ '^mk-[a-z0-9-]{1,24}$' then g2 := null; end if;
  begin bw := (p_show->>'base_wins')::numeric; exception when others then bw := null; end;
  if bw is not null and (bw < 0 or bw > 1e12) then bw := null; end if;
  begin wpw := (p_show->>'wins_per_word')::double precision; exception when others then wpw := null; end;
  if wpw is not null and (wpw < 0 or wpw > 1e300 or wpw = 'NaN'::double precision) then wpw := null; end if;
  begin gf := (p_show->>'gears_found')::integer; exception when others then gf := null; end;
  if gf is not null and (gf < 0 or gf > 500) then gf := null; end if;
  begin gt := (p_show->>'gears_total')::integer; exception when others then gt := null; end;
  if gt is not null and (gt < 0 or gt > 500) then gt := null; end if;
  begin pw := (p_show->>'power')::integer; exception when others then pw := null; end;
  if pw is not null and (pw < 0 or pw > 1000) then pw := null; end if;
  insert into public.profile_showcase as s (profile_id, gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power, updated_at)
  values (pid, g1, g2, bw, wpw, gf, gt, pw, now())
  on conflict (profile_id) do update set
    gear1 = excluded.gear1, gear2 = excluded.gear2, base_wins = excluded.base_wins, wins_per_word = excluded.wins_per_word,
    gears_found = excluded.gears_found, gears_total = excluded.gears_total, power = excluded.power, updated_at = now()
  where s.updated_at < now() - interval '20 seconds'; -- a write a player can spam lands at most every 20 s
  return json_build_object('ok', true);
end $$;
revoke all on function public.lb_showcase_set(text, jsonb) from public;
grant execute on function public.lb_showcase_set(text, jsonb) to anon, authenticated;
