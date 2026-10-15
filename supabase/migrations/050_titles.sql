-- 050_titles.sql - LEADERBOARD TITLES (Andy oct15 night "ways for people on leaderboard to feel even more addicted ...
-- cosmetics or smthn so people can see more of you"). A TEXT title under a player's name on every board row, EARNED in
-- play and PICKED by the player (client titles.js: a fixed id list - never free text, nothing to moderate).
--   title   the picked title's id, ^[a-z0-9-]{1,24}$ (anything else stores null)
-- Same function as 046 otherwise; it now answers v = 50 so the client knows the title was stored. Safe to re-run. ASCII only.

alter table public.profile_showcase add column if not exists title text;

create or replace function public.lb_showcase_set(p_secret text, p_show jsonb)
returns json language plpgsql security definer set search_path = public, private, pg_temp as $$
declare pid uuid; g1 text; g2 text; bw numeric; wpw double precision; gf integer; gt integer; pw integer;
  bd jsonb := '{}'::jsonb; k text; t integer; sw text; sb text; bc integer; ti text;
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then raise exception 'bad_secret'; end if;
  pid := private.profile_for_secret(p_secret);
  if pid is null then return json_build_object('error', 'no_profile'); end if;
  if p_show is null or jsonb_typeof(p_show) <> 'object' or length(p_show::text) > 2000 then
    return json_build_object('error', 'bad_show');
  end if;
  g1 := p_show->>'gear1'; if g1 is not null and g1 !~ '^mk-[a-z0-9-]{1,24}$' then g1 := null; end if;
  g2 := p_show->>'gear2'; if g2 is not null and g2 !~ '^mk-[a-z0-9-]{1,24}$' then g2 := null; end if;
  g1 := private.gear_check(pid, g1); -- 036: only gears the server knows (or the audit grandfathered)
  g2 := private.gear_check(pid, g2);
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
  -- 046 PROFILE FLEX: badges (the top claimed tier of each achievement ladder), the signature word, the best chain
  if jsonb_typeof(p_show->'badges') = 'object' then
    for k in select jsonb_object_keys(p_show->'badges') loop
      if k in ('type', 'bots', 'reb', 'roll', 'win', 'chain', 'index', 'power') then
        begin t := (p_show->'badges'->>k)::integer; exception when others then t := null; end;
        if t is not null and t >= 1 and t <= (case when k = 'index' then 3 else 5 end) then bd := bd || jsonb_build_object(k, t); end if;
      end if;
    end loop;
  end if;
  sw := lower(p_show->>'sig_word'); if sw is not null and sw !~ '^[a-z]{3,24}$' then sw := null; end if;
  sb := p_show->>'sig_band'; if sb is null or sb not in ('COMMON', 'UNCOMMON', 'RARE', 'OBSCURE') or sw is null then sb := null; end if;
  begin bc := (p_show->>'best_chain')::integer; exception when others then bc := null; end;
  if bc is not null and (bc < 0 or bc > 100000) then bc := null; end if;
  -- 050 TITLES: an id from the client's fixed list (titles.js), never free text
  ti := lower(p_show->>'title'); if ti is not null and ti !~ '^[a-z0-9-]{1,24}$' then ti := null; end if;
  insert into public.profile_showcase as s (profile_id, gear1, gear2, base_wins, wins_per_word, gears_found, gears_total, power, badges, sig_word, sig_band, best_chain, title, updated_at)
  values (pid, g1, g2, bw, wpw, gf, gt, pw, bd, sw, sb, bc, ti, now())
  on conflict (profile_id) do update set
    gear1 = excluded.gear1, gear2 = excluded.gear2, base_wins = excluded.base_wins, wins_per_word = excluded.wins_per_word,
    gears_found = excluded.gears_found, gears_total = excluded.gears_total, power = excluded.power,
    badges = excluded.badges, sig_word = excluded.sig_word, sig_band = excluded.sig_band, best_chain = excluded.best_chain, title = excluded.title, updated_at = now()
  where s.updated_at < now() - interval '20 seconds';
  return json_build_object('ok', true, 'v', 50);
end $$;

revoke all on function public.lb_showcase_set(text, jsonb) from public;
grant execute on function public.lb_showcase_set(text, jsonb) to anon, authenticated;
grant select on public.profile_showcase to anon, authenticated;
