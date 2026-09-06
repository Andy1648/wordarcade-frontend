# JOB 4 — MEDIUM audit fixes (fix/audit-mediums)

Fixes for the MEDIUM findings from `audit-a11y.md`, `audit-copy.md`, `audit-mobile.md`. Before/after
for each. Build green (`vite build` exit 0); no test asserted on any renamed string.

## 1. Mode dialogs — no focus-in, no Tab trap  (a11y MED-1)
`src/components/ModeDialog.jsx`.
- **Before:** the Word Bomb / Category Blitz dialog (`role="dialog" aria-modal`) never moved focus in
  on open (focus stayed on the menu) and never trapped Tab — Tab walked straight out to the still-
  focusable menu mode cards behind the modal. (Escape already closed it.)
- **After:** added `tabIndex={-1}` to the shell and a focus effect that (a) focuses the shell on open,
  and (b) traps Tab — Tab/Shift-Tab now cycle within the dialog's focusable controls (wrapping first↔last)
  and can't reach the background. Escape still closes. Mirrors the SHOP overlay's focus-on-open and adds
  the containment the dialog was missing.

## 2. Colour-contrast on locked cells  (a11y MED-2)
- **Stats locked PERSONAL RECORDS** (`StatsScreen.css`): `.rec-cell--locked .rec-label` was `#6f5f8e`
  (~3.5:1 on the `#0d0618` cell) → **`#8f7eb2` (~5.5:1)**; `.rec-req` was `#7a6a99` (~4.1:1) →
  **`#8f7eb2` (~5.5:1)**. Still clearly muted/locked, now AA.
- **Shop locked theme cards** (`ShopScreen.css`): the root cause was `.shop-card.is-locked { opacity:0.5 }`
  dragging the price/gap text below 4.5:1. Raised to **`opacity:0.72`** (still visibly dimmed; lock also
  reads from the lock icon + unaffordable price) and gave the two failing nodes bright in-palette values:
  `.shop-card-price` → **`#e6ddf5`**, `.shop-card-gap` → **`#d8cfe8`** (solid; was `rgba(240,234,217,.6)`,
  whose alpha compounded with the card opacity). All within the muted locked palette — no locked *hue*
  changed, only lightness/opacity. **Nothing here required changing a locked colour to pass.**
- The two 1-node clusters the audit also listed (Word Bomb dialog `.mode-ex-pay > b` orange `#FF6B3D`
  "40"; Join Room `.browser-title`) were NOT in JOB 4's scope (it named Stats + Shop) — left for a
  follow-up; both are single decorative/heading nodes, not blocked content.

## 3. Lobby `aria-prohibited-attr`  (a11y MED-3)
`src/components/WaveText.jsx` (the component behind the Lobby title + the Room code).
- **Before:** `<span className={className} aria-label={str}>` with per-letter `aria-hidden` spans — an
  `aria-label` on a generic (role=generic) `<span>`, which axe flags as prohibited (the name is dropped).
- **After:** the accessible name is now a **real visually-hidden text node** (`<span style={SR_ONLY}>{str}</span>`),
  and the decorative per-letter spans sit inside one `aria-hidden` wrapper. Screen readers read the whole
  word once; no `aria-label` on a generic span. Fixes it for BOTH WaveText usages (lobby title + room code).

## 4. Rarity axis: 5 names → 2  (copy A2)
Survivors: **RARITY** (the word's own tier) and **WORD SENSE** (the shop upgrade). Every string changed:
| Where | Before | After |
|---|---|---|
| `CollectionScreen.jsx` section heading | `BY TIER` | `BY RARITY` |
| `achievements.js` `obs-1` name | `DEEP CUT` | `OBSCURITY` |

- `COMMON / UNCOMMON / RARE / OBSCURE` are kept as the **tier VALUES** of the RARITY axis (every rarity
  system needs value labels) — they are values, not competing axis names, so "OBSCURE FINDS" (Stats) and
  the per-tier Collection labels stay. This is the deliberate reading of "one name for the word's tier":
  the *axis* is RARITY, its rarest *value* is OBSCURE.
- `DEEP CUT` was the 5th synonym AND collided with SAT Rush's DESIGN.md-sanctioned "deep cut" (a hard
  bounty word) — renaming the achievement to `OBSCURITY` (derived from the OBSCURE tier value) removes the
  synonym and the collision. SAT Rush keeps its own "deep cut".
- Upgrade-level wording `KEY POWER — TIER n` / `WORD SENSE — TIER n` uses "TIER" to mean the *upgrade
  level* (T1, T2…), a different, standard sense — left as-is (WORD SENSE is the name; "TIER n" is its
  level). Flagged here as an intentional keep.

## 5. REBIRTH synonyms  (copy A4)
Standardised on **REBIRTH**. Every string changed:
| Where | Before | After |
|---|---|---|
| `unlockLadder.js` frame reward | `PRESTIGE n` | `REBIRTH n` |
| `achievements.js` `reb-1` name | `REBORN` | `REBIRTH` |
| `achievements.js` `reb-5` name | `PHOENIX` | `REBIRTH ×5` |

- The `sec-eternal` secret achievement `ETERNAL` (rebirth ×10) was NOT in the job's named list
  (PRESTIGE / REBORN / PHOENIX) and is a secret-tier flavour title whose hint already says "Rebirth 10
  times." Left as intentional secret flavour; flagged for Andy if he wants it folded to `REBIRTH ×10`.

All internal ids/keys (`rebirth-n`, `reb-1`, `reb-5`, `obs-1`, the `TIERS` array) are unchanged — only
user-facing display strings moved, so no save/achievement-grant logic is affected.
