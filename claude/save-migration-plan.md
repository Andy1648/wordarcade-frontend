# JOB B — Versioned save data: migration plan (READ BEFORE ANY CODE)

Branch: `feat/save-schema` (branch-only, do NOT merge). **No migration code is written yet** — this
file is the key-by-key plan you asked to read first, because this touches live player progress.

## The scheme
- New single key **`taw.save = { v: <int>, data: { …all slices… } }`** (one JSON string).
- **v0 = today's world**: the 28 loose `taw.*` keys, exactly as they are now.
- A **migration chain**: `MIGRATIONS = [ v0→v1, v1→v2, … ]`. Each migration is a **pure function**
  `(data) => data'` with a unit test proving it converts a realistic prior blob correctly.
- **Load algorithm** (safe, idempotent):
  1. Read `taw.save`. If present and parseable → take its `{v, data}`.
  2. If absent → build a v0 `data` by reading the 28 legacy keys (verbatim strings).
  3. Run every migration from the detected `v` up to `CURRENT` in order.
  4. **Write `taw.save` back atomically** (one `setItem` of the whole blob).
  5. Hand each module its slice from `taw.save.data`.
- **Legacy keys: keep READING them as the v0 source; STOP WRITING them.** After v1, all writes go to
  `taw.save.data[...]`; the loose keys are never updated again (they remain as a frozen v0 snapshot).

## v0 → v1 is a pure WRAP — no value is transformed
v1's only job is to move each loose key's **raw string value, byte-for-byte**, under
`taw.save.data['<key>']`. No parsing, no reshaping, no defaulting at migration time (defaults stay
where they already live — in each module's loader). So v1 is shape-agnostic and cannot corrupt a
value: it copies the exact string `localStorage` already holds (or omits the key if absent, which
each module's loader already tolerates as "new player").

## KEY-BY-KEY (all 28) — what v1 does to each
Type is "as currently stored"; v1 copies the raw value verbatim regardless. "Survives rebirth" noted
where it matters (rebirth must never clear these).

| # | key | holder | type (current) | v1 action | rebirth-safe |
|---|---|---|---|---|---|
| 1 | `taw.wins` | progress/wins | number str | verbatim → data | resets on rebirth (spendable) |
| 2 | `taw.winsLifetime` | progress/wins | number str | verbatim | YES — never decremented |
| 3 | `taw.xp` | progress/xp | JSON `{lv,into}` | verbatim | resets to LV1 on rebirth |
| 4 | `taw.rebirths` | progress/xp | number str | verbatim | YES |
| 5 | `taw.keytier` | progress/xp | number str | verbatim | YES (permanent buy) |
| 6 | `taw.wordsense` | progress/wordSense | number str | verbatim | YES |
| 7 | `taw.momentum` | progress/momentum | number str | verbatim | YES |
| 8 | `taw.mastery` | progress/mastery | JSON per-mode | verbatim | YES |
| 9 | `taw.collection` | progress/collection | JSON | verbatim | YES |
| 10 | `taw.achievements` | progress/achievements | JSON set | verbatim | YES |
| 11 | `taw.records` | progress/records | JSON | verbatim | YES |
| 12 | `taw.records.seen` | progress/records | JSON/flag | verbatim | YES |
| 13 | `taw.streak` | daily or progress/streak | JSON `{count,lastDay,freezes}` | verbatim | YES |
| 14 | `taw.equipped` | progress/shop | JSON/str | verbatim | YES (cosmetic) |
| 15 | `taw.owned` | progress/shop | JSON ids | verbatim | YES |
| 16 | `taw.themesOwned` | theme/themes | JSON ids | verbatim | YES |
| 17 | `taw.theme` | theme/themes | string id | verbatim | YES |
| 18 | `taw.freeUnlocks` | progress/unlockLadder | JSON | verbatim | YES |
| 19 | `taw.chain.runs` | solo | number str | verbatim | YES |
| 20 | `taw.fuse.runs` | solo | number str | verbatim | YES |
| 21 | `taw.rounds` | progress | number str | verbatim | ? (confirm) |
| 22 | `taw.returnClaim` | progress/returnBonus | JSON/ts | verbatim | YES |
| 23 | `taw.seenWinsHint` | components/MenuXp | flag `'1'` | verbatim | n/a (UX one-shot) |
| 24 | `taw.sfxEvents` | audio | JSON | verbatim | n/a |
| 25 | `taw.clack` | audio | flag | verbatim | n/a |
| 26 | `taw.audioVolume` | audio | number str | verbatim | n/a |
| 27 | `taw.musicMuted` | audio | flag | verbatim | n/a |
| 28 | `taw.wpm` | progress/wpm | JSON | verbatim | YES |

(Types marked from usage; if any differ the verbatim copy is still correct — v1 never inspects them.
The one I want to confirm before coding: whether `taw.rounds` and the audio/UX flags should even live
in the save blob, or stay as device-local loose keys — see Open questions.)

## INTERRUPTION ANALYSIS (the part that protects live progress)
**Claim: there is no destructive half-state.** Why:
1. **The v1 write is a single `localStorage.setItem('taw.save', json)`** — synchronous and atomic
   per key. It either lands whole or not at all; it can never be "half a blob."
2. **Legacy keys are never deleted or overwritten by the migration.** So at every instant one of two
   consistent worlds exists: (a) `taw.save` absent → the 28 legacy keys are the source of truth
   (pre-v1 behaviour, unchanged); (b) `taw.save` present → it is complete (atomic write) and becomes
   the source of truth. A crash between reading legacy and writing `taw.save` simply leaves world (a)
   — the next load rebuilds and rewrites. Idempotent.
3. **The dangerous ordering we will NOT do:** writing `taw.save` and THEN clearing legacy keys in a
   second step. That two-step delete is the only way to lose data, so v1 does not delete legacy at
   all. (A future cleanup migration could, but only long after v1 is proven, and is out of scope.)
4. **Corrupt `taw.save`** (bad JSON, wrong shape, truncated by a full-disk quota error): the loader
   `try/catch`es the parse; on failure it **falls back to reading the legacy keys** (still present),
   i.e. world (a). It never throws and never wipes. Worst case a player who corrupted `taw.save`
   reverts to their last legacy snapshot — lossy only for progress made after v1 first wrote, which
   is why (5).
5. **Every write after v1 updates `taw.save` atomically** (read-modify-write the whole blob on each
   slice change), so the legacy snapshot going stale is expected; the live truth is `taw.save`.
   The quota risk (one bigger key vs 28 small ones) is well under localStorage's ~5MB.

## EXPORT / IMPORT (the backup that does not exist today)
- **Export:** `btoa(unescape(encodeURIComponent(JSON.stringify(taw.save))))` → a copyable base64 blob
  in Stats. (UTF-8-safe base64; the save is ASCII-ish but be safe.)
- **Import:** paste → `JSON.parse(decodeURIComponent(escape(atob(text))))` → validate it has a numeric
  `v` and an object `data` → **run it through the SAME migration chain** (so an old export upgrades)
  → atomic `setItem('taw.save', …)` → reload. Reject (no write) if it isn't a valid `{v,data}`.
- Guardrails: confirm-before-overwrite dialog (import replaces everything); never auto-import; the
  export is inert text (no auto-download, per the artifact/download constraints — copy to clipboard).

## TEST PLAN (all pure, keyless)
1. **v0→v1 on a realistic blob:** seed the 28 loose keys with real-looking values → migrate → assert
   `taw.save.v===1` and every value present verbatim under `data`, and each module's loader reads the
   same values it did from the loose keys.
2. **Corrupt data → defaults, no throw:** `taw.save='{'` (bad JSON) and a `{v:1,data:null}` → loader
   returns each module's default without throwing; legacy fallback still works.
3. **Export → import round-trips exactly:** export a populated save, wipe, import → deep-equal the
   restored `taw.save`.
4. **v2 stub proves the chain runs in order:** add a no-op-ish `v1→v2` (e.g. renames a scratch key) +
   assert a v0 blob ends at v2 having passed through v1 (ordering + idempotency).

## OPEN QUESTIONS (want your call before I write code)
1. **Scope of the blob:** include the device-local audio/UX flags (`clack`, `audioVolume`,
   `musicMuted`, `sfxEvents`, `seenWinsHint`)? They're device preferences, not "progress" — arguably
   they should stay loose (so a save export moves PROGRESS, not a device's mute setting). My default:
   **exclude the 5 device/UX keys from the blob** (keep them loose), include the 23 progression keys.
   Confirm.
2. **Write strategy:** read-modify-write the whole `taw.save` on every slice change is simplest and
   safe; it does mean each save re-serialises ~23 keys. Fine at this size — confirm you're happy with
   it vs a debounced writer.
3. **Rollout:** do we migrate on the very next load for everyone (silent), or gate behind a flag for a
   session first? My default: silent on next load (it's non-destructive), with the export/import
   backup shipping in the SAME release so a worried player can snapshot first.

**STOPPING HERE per your instruction — no migration code until you've read this.**
