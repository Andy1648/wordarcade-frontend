-- rollback-season2-convert.sql — UNDO 025_season2_convert.sql (claude/run-season2-convert.sql). WRITE-ONLY: Andy runs
-- it only if the conversion must be undone. Restores rebirths + stars from the snapshot 025 took
-- (private.season2_convert) — the only two columns 025 changed — and re-arms 025 (clears its marker and snapshot) so it
-- can run again.
--
-- SAFE AFTER PLAY: a row is restored only if it still holds exactly what 025 wrote (rebirths_after / stars_after). A row
-- that has moved since (a rebirth, an ascension, a reset) is LEFT AS IT IS and listed in a notice — run this BEFORE
-- "flip SEASON2" for a clean undo. Then `notify pgrst, 'reload schema';`.

do $$
declare n_back integer; n_moved integer;
begin
  if to_regclass('private.season2_convert') is null then
    raise notice 'rollback: 025 never ran — nothing to undo';
    return;
  end if;
  lock table public.profiles in share row exclusive mode;
  select count(*) into n_moved
    from private.season2_convert c join public.profiles p on p.id = c.profile_id
   where p.rebirths is distinct from c.rebirths_after or p.stars is distinct from c.stars_after;
  update public.profiles p
     set rebirths = c.rebirths_before, stars = c.stars_before
    from private.season2_convert c
   where c.profile_id = p.id
     and p.rebirths is not distinct from c.rebirths_after and p.stars is not distinct from c.stars_after
     and (c.rebirths_before is distinct from c.rebirths_after or c.stars_before is distinct from c.stars_after);
  get diagnostics n_back = row_count;
  if n_moved > 0 then
    raise notice 'rollback: % rows changed since 025 and were NOT restored: %', n_moved,
      (select string_agg(p.username || ' R' || p.rebirths || ' ★' || p.stars || ' (025 wrote R' || c.rebirths_after
                         || ' ★' || c.stars_after || ', before R' || c.rebirths_before || ' ★' || c.stars_before || ')', '; ')
         from private.season2_convert c join public.profiles p on p.id = c.profile_id
        where p.rebirths is distinct from c.rebirths_after or p.stars is distinct from c.stars_after);
  end if;
  -- re-arm 025: the restored rows' snapshot + the one-shot marker go (moved rows keep their snapshot as the record)
  delete from private.season2_convert c using public.profiles p
   where p.id = c.profile_id and p.rebirths is not distinct from c.rebirths_before and p.stars is not distinct from c.stars_before;
  delete from private.season2_convert_run;
  raise notice 'rollback: restored % rows to their pre-025 rebirths + stars', n_back;
end $$;
