-- 056_cloud_blob_1mb.sql — raise the cloud-save size cap from 64 KB to 1 MB (oct21 progression bug audit, B2).
--
-- WHY: every cloud-save writer refused a blob over 65,536 characters (`bad_blob`), and the client swallowed the error.
-- A save carries the whole word collection (taw.collection reaches ~140 KB at 5,000 words), so heavy players crossed
-- the cap at ~1,300–1,500 distinct words and their cloud copy silently froze from then on. The client now gzip-packs
-- the blob (src/save/cloudCodec.js, ~2.7× smaller), which alone only moves the wall to ~4,000 words; this lifts it to
-- 1 MB (~40,000+ words packed).
--
-- HOW: no function body is re-typed here. Every public function whose source contains the 65536 literal (lb_save,
-- lb_save2, lb_reset_ack, lb_self_reset, …) is re-created from its OWN current definition with that one number
-- changed, so nothing else about them can drift. Then the table's CHECK is swapped.
-- ADDITIVE and re-runnable (a second run finds no 65536 left and changes nothing).
--
-- NOTE for hand-written SQL: from this release the cloud blob may be gzip-packed (it starts with 'tawz1:'), so
-- convert_from(decode(blob,'base64'),'UTF8') no longer reads it. Unpack it client-side, or only touch plain blobs.

do $$
declare
  r record;
  def text;
  n integer := 0;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%length(p_blob) > 65536%'
  loop
    def := pg_get_functiondef(r.oid);
    execute replace(def, 'length(p_blob) > 65536', 'length(p_blob) > 1048576');
    n := n + 1;
    raise notice 'raised the blob cap in %', r.proname;
  end loop;
  raise notice '% function(s) updated', n;
end $$;

-- the table's own CHECK (006: `check (length(blob) <= 65536)`, auto-named cloud_saves_blob_check)
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_namespace ns on ns.oid = t.relnamespace
     where ns.nspname = 'private' and t.relname = 'cloud_saves' and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%65536%'
  loop
    execute format('alter table private.cloud_saves drop constraint %I', c.conname);
    raise notice 'dropped %', c.conname;
  end loop;
  if not exists (
    select 1 from pg_constraint con join pg_class t on t.oid = con.conrelid join pg_namespace ns on ns.oid = t.relnamespace
     where ns.nspname = 'private' and t.relname = 'cloud_saves' and con.conname = 'cloud_saves_blob_1mb'
  ) then
    alter table private.cloud_saves add constraint cloud_saves_blob_1mb check (length(blob) <= 1048576);
  end if;
end $$;

-- VERIFY (read only): expect no function still holding the old cap, and the new constraint present.
select p.proname
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) like '%length(p_blob) > 65536%';
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'private.cloud_saves'::regclass and contype = 'c';
