-- 072_restore_daan.sql — put daan's rebirths back on the board (Andy oct27). ONE-OFF. Claude never runs SQL.
--
-- WHAT HAPPENED (side-session-notes/daan-reset-diagnosis.md): his browser lost the board account (the device secret), so
-- the "Daan" row (fe57cdaf…, R26, frozen since Oct 22) belongs to nobody now. His SAVE survived and plays as "dan"
-- (e29427f6…, created Oct 26; same signature word "assessment" and best chain 27). That row's first write clamped him to
-- R2, and a submit could never raise it, so it shows R2 at LV 514.
--
-- THIS FILE: raises "dan" to at least what "Daan" proved on the server: R26 and 1842 words / 12766 letters. ONLY RAISES
-- (greatest), IDEMPOTENT (safe to run twice), touches only those two ids and checks their names. After 070 runs, his
-- next push raises R the rest of the way to his real count by itself.
-- ORDER: any time (070 first is best, so the climb continues on its own).

update public.profiles d
   set rebirths         = greatest(d.rebirths, o.rebirths),
       lifetime_words   = greatest(d.lifetime_words, o.lifetime_words),
       lifetime_letters = greatest(coalesce(d.lifetime_letters, 0), coalesce(o.lifetime_letters, 0)),
       stars            = greatest(coalesce(d.stars, 0), coalesce(o.stars, 0)),
       updated_at       = now()
  from public.profiles o
 where d.id = 'e29427f6-0302-4523-8c34-409abdec70f9' and d.username = 'dan'
   and o.id = 'fe57cdaf-1526-4d26-a665-9e41ec2fb8e2' and o.username = 'Daan'
   and (d.rebirths < o.rebirths or d.lifetime_words < o.lifetime_words
        or coalesce(d.lifetime_letters, 0) < coalesce(o.lifetime_letters, 0) or coalesce(d.stars, 0) < coalesce(o.stars, 0));

-- OPTIONAL (Andy's call; left commented): give him his old NAME back. The orphaned "Daan" row becomes "Daan_old" (it
-- stays on the board, owned by nobody), and his live row takes "Daan". Uncomment both lines and run them together.
-- update public.profiles set username = 'Daan_old' where id = 'fe57cdaf-1526-4d26-a665-9e41ec2fb8e2' and username = 'Daan';
-- update public.profiles set username = 'Daan' where id = 'e29427f6-0302-4523-8c34-409abdec70f9' and username = 'dan';

-- VERIFY: "dan" (or "Daan" after the optional rename) should read R ≥ 26, words ≥ 1842.
select id, username, level, rebirths, stars, lifetime_words, lifetime_letters, submitted_at
  from public.profiles
 where id in ('e29427f6-0302-4523-8c34-409abdec70f9', 'fe57cdaf-1526-4d26-a665-9e41ec2fb8e2')
 order by rebirths desc;
