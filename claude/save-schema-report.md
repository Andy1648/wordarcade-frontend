# JOB 5 — versioned save schema (feat/save-schema) — DO NOT MERGE (Andy reviews first)

Implements `claude/save-migration-plan.md`. Branch was stale (plan-only, off old main); rebuilt off
current main. Gate: `vite build` exit 0, lint 0 errors, unit **444/444** (the 5 new schema tests + the
existing 439).

## What shipped
- **`src/save/schema.js`** — the versioned envelope `taw.save = { v, data }`:
  - `buildV0FromLegacy()` — reads the 23 progression keys (the `PROGRESS_KEYS` allowlist reused from
    `saveBackup.js`) VERBATIM into `data`; the 5 device/UX keys are excluded, matching the export path.
  - `MIGRATIONS` — pure `(data)=>data` chain. `v0→v1` is a byte-for-byte wrap (transforms NO player
    value); `v1→v2` is the required stub. Both only ever touch a test-only `taw.__probe` scratch key, so
    on real saves they are strict identity.
  - `migrate(save)` — pure (clones input), runs each step from `save.v`→`CURRENT_VERSION` in order,
    throws on an invalid or newer-than-app envelope so callers can fall back.
  - `loadSave()` — detect `taw.save` (parse+migrate) or rebuild from legacy, then write back atomically
    (one `setItem`). Never throws, never wipes; corrupt blob → falls back to the legacy world.
  - `exportVersionedSave()` / `parseVersionedSave()` / `importVersionedSave()` — base64 `{format,v,data}`;
    import validates fully (strict `PROGRESS_KEYS` allowlist, string values) BEFORE writing anything.
- **`src/main.jsx`** — a guarded `loadSave()` on boot (after `initTheme`), so the migration runs on load.
- **`src/save/schema.test.js`** — the 5 required cases, all green:
  1. v0→v1 on a realistic 28-key blob (23 wrapped verbatim, 5 device keys excluded).
  2. corrupt `taw.save` → recovers from legacy without throwing; garbage import writes nothing.
  3. an interrupted (throwing) `taw.save` write leaves NO half-blob and legacy fully intact; the next
     load recovers.
  4. export → wipe → import round-trips every progress key and lands at `CURRENT_VERSION`.
  5. the chain runs every step in order (`start:v1:v2`), starting mid-chain applies only later steps,
     `migrate` doesn't mutate its input, and a newer-than-app save is rejected.

## Interruption safety (why this can't lose progress)
A single `setItem('taw.save', …)` is atomic and legacy is never deleted, so at every instant either
`taw.save` is absent (legacy is the truth) or present-and-whole. A crash mid-load leaves the legacy
world, which the next load rebuilds. `importVersionedSave` restores into BOTH `taw.save` and the loose
keys (the live read path), so a restore is immediately visible to the running app. (Test 3 proves the
failed-write case.)

## Decisions taken (the plan's open questions — chose the plan's stated defaults)
1. **Blob scope:** the 5 device/UX keys (`clack`, `audioVolume`, `musicMuted`, `sfxEvents`,
   `seenWinsHint`) are EXCLUDED — a save carries progress, not a device's audio settings.
2. **Write strategy:** whole-blob atomic write (fine at this size).
3. **Rollout:** silent migration on next load (non-destructive); the existing export/import backup
   already ships as the safety net.

## Deferred — the genuinely Tier-1 step (NOT done here, on purpose)
The plan's steady-state goal "**stop writing the loose keys** — all writes go to `taw.save.data`"
requires rewiring **~30 `localStorage.setItem` call sites across ~15 live-progress modules** (there is
NO shared storage chokepoint — each module hits `localStorage` directly). Doing that unsupervised, in
one branch, is exactly the Tier-1 risk the "DO NOT MERGE / Andy reviews" guard exists for (and a partial
cutover would create a split-brain where some keys live in the blob and some in legacy — worse than
either end-state). So this branch keeps the **loose keys authoritative** and `taw.save` as the versioned,
migratable, exportable **mirror + export source** (always rebuilt fresh from legacy, so never stale).
The writer cutover is the reviewed follow-up: introduce a `saveStore.get/set` facade, point the 30 sites
at it one module at a time, each with its own unit test + the 2-device regression pass.

Net: the schema, migrations, load/migrate/atomic-writeback, export/import, and all 5 required tests are
delivered and green; the live-progress writer cutover is staged for supervised review.
