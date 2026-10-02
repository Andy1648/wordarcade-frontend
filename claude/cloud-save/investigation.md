# STEP 52 — why a friend's progress "reset" (investigation)

All progress lived in ONE browser's `localStorage` on `typeaword.com`. Anything that gives the player
a different or emptied storage looks exactly like a reset. Checked, most likely first:

| cause | how it happens | evidence / status |
|---|---|---|
| **Safari / iOS ITP 7-day purge** | Safari deletes ALL script-writable storage (localStorage, IndexedDB, script cookies) for a site the user has not interacted with in 7 days of Safari use. Home-screen web apps are exempt. | WebKit policy since iOS 13.4. The most likely cause for an iPhone friend who stopped for a week. |
| **In-app browsers** | A link opened inside Discord / Instagram / TikTok / Snapchat runs in that app's webview with its OWN storage, separate from Safari/Chrome. "Same game, LV 1". | Fits "it reset when I opened it from the group chat". |
| **Different browser / device / private window** | Storage is per browser profile; private windows start empty and are wiped on close. | — |
| **Clearing history / website data** | Safari "Clear History and Website Data", Chrome "Cookies and site data". | — |
| **Domain** | `www.typeaword.com` 308-redirects to `typeaword.com` (one origin), and Vercel preview URLs are separate origins (testers only). | Verified with `curl -I`: no split origin for players. |
| **Economy v9 migration** (#75) | `econMigrate.js` caps the SPENDABLE wins balance at 10 KEY POWER prices, once. Level, rebirths, key tiers, cosmetics, mastery, collection, achievements are kept. | Not a reset — but a big wins number dropping to a smaller one can READ like one. Itemised in claude/econ-oct2/report.md. |
| **MOMENTUM → FORGE / themes retired / marks** | One-time migrations carry everything over (momentum buys → forge buys; bought themes → a refund claim; earned marks → owned). | Unit + e2e tested; none lowers progress. |
| **Code that clears storage** | `grep` for `localStorage.clear`, removal of `taw.xp/wins/rebirths`: none outside the rebirth itself. | Clean. |

## The fix (this PR)
- **Cloud save**: progress (the validated save export, 43 keys) is backed up to Supabase with every
  stats push (throttled to 1/min), tied to the claimed name's device secret. The DB **ignores a save
  with a lower progress score** (rebirths, then level, then lifetime letters).
- **Automatic restore**: the menu loads the cloud save when it is STRICTLY ahead of this browser and
  reloads into it. A browser that is ahead (played offline) keeps its own progress.
- **Identity survives a storage-only wipe**: the secret is mirrored in a 400-day first-party cookie.
  (ITP purges script cookies too after 7 idle days — that case is what the code is for.)
- **Recovery code** (the secret as 12 groups of 4) is shown right after claiming, and on demand
  ("RECOVERY CODE"); "HAVE A RECOVERY CODE?" on the board restores it on a new device.
- Needs `supabase/migrations/006_cloud_save.sql` applied (after 005). Until then the feature is off
  (lb_caps has no `cloud`), and nothing else changes.

Tests: src/save/cloudSave.test.js (score order, never-lower, restore, backup throttle, code
round-trip), e2e/cloud-save.spec.js (claim → code → wipe → auto-restore; new device → code → restore;
a browser ahead keeps its save).
