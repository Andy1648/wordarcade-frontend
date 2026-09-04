# MENU SECRETS (Job 9, feat/secrets)

Five undocumented easter eggs on the menu. **None are hinted anywhere in the UI.** Each
fires **once**, grants flat Wins, and flashes a one-shot yellow STAMP (pointer-events:none,
auto-removes after 2.4s). Logic is a pure, fully-unit-tested detector
(`src/secrets/menuSecrets.js`, 8 tests); wired to the menu via `useMenuSecrets` +
Homepage (its own keydown listener, never touches XP scoring).

**Andy — here are all five (players get no such list):**

| # | Secret | How to trigger | Stamp | Wins |
|---|--------|----------------|-------|------|
| 1 | **TYPED WORD** | Type `newgrounds` anywhere on the menu | `O.G.` | 150 |
| 2 | **RARE POP** | A 1-in-750 menu keystroke pop comes out **golden** — catching one | `MIDAS TOUCH` | 100 |
| 3 | **TIME OF DAY** | Type anything on the menu at local **11:11** (am *or* pm) | `MAKE A WISH` | 111 |
| 4 | **TYPING STREAK** | **150** menu keystrokes with no gap longer than 1.5s | `TYPEWRITER` | 200 |
| 5 | **PALINDROME** *(invented)* | Type a 5+ letter palindrome (`kayak`, `level`, `rotor`, `civic`, `racecar`…) | `BOTH WAYS` | 250 |

## Notes
- **One-time each.** A `found` set persists in `localStorage` (`wa_menu_secrets`); a
  storage-blocked browser just re-arms them (never crashes).
- **Rewards are small on purpose** (100–250 Wins, the biggest ≈ one good round) — a wink,
  not an economy exploit.
- **#5 (palindrome)** accepts the curated list plus any genuinely-symmetric 5+ letter run
  that isn't a single repeated letter (so `aaaaa` does **not** count, an unlisted real
  palindrome does).
- Every hit also fires the existing `secret_found` analytics event (id per row above), so
  discovery rates are measurable.
- The stamp animation is a finite one-shot (transform/opacity only) — no new infinite loops,
  passes the animation-budget tests.

## Files
- `src/secrets/menuSecrets.js` — the pure detector (injected now/rng/storage).
- `src/secrets/menuSecrets.test.js` — 8 tests (each secret + persistence + definitions).
- `src/secrets/useMenuSecrets.js` — the menu-only wiring hook (grant + transient stamp).
- `src/components/Homepage.jsx` / `Homepage.css` — mount + the stamp overlay.
