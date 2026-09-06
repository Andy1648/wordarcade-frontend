# Accessibility Audit — TYPE A WORD

Branch: `main` @ `379af8a` · Date: 2026-09-02
Method: production build (`vite build`) served on `:4185`, driven with Playwright + Chromium
(mobile viewport 400×850). axe-core 4.10.2 injected by source content on each screen
(WCAG 2.0/2.1 A+AA + best-practice). Backend WS + all non-localhost HTTP mocked (same
intercept the e2e suite uses). Keyboard walkthrough = real Tab / Shift-Tab / Enter / Space /
Escape, with a refutation pass on every HIGH.

Screens covered: Menu, Word Bomb mode dialog, Category Blitz dialog + PackPicker, Shop,
Rebirth, Stats (+Collection/Achievements tabs), Join Room browser, Lobby (Create), SAT Rush
briefing, CHAIN (in-game + game-over), FUSE. Not driven: the live multiplayer GameScreen
(Word Bomb / Category Blitz in-progress) — scoped out per the solo-first priority; solo
in-game + game-over WERE audited as the representative game surfaces.

---

## HEADLINE — UNREACHABLE / UNUSABLE WITHOUT A MOUSE

### HIGH-1 — Every SHOP purchase is impossible with keyboard only  *(refutation-tested)*
The buy control (`HoldBuy`, `src/components/ShopScreen.jsx:519`) is a press-and-HOLD button
wired to **pointer events only** — `onPointerDown` (start) / `onPointerUp` / `onPointerLeave`
/ `onPointerCancel` (cancel). It has **no `onClick` and no `onKeyDown`**. A native `<button>`
translates keyboard Enter/Space into a synthetic `click`, never into `pointerdown`/`pointerup`,
so a focused keyboard user activating it fires nothing — no fill, no commit, no purchase.

`HoldBuy` is the buy control for **everything** in the shop:
- KEY POWER upgrade (`:217`), WORD SENSE upgrade (`:250`), MOMENTUM upgrade (`:294`)
- cosmetics — POP STYLES / SOUND PACKS (`:445`)
- THEMES (`:488`)

So no upgrade, cosmetic, or theme can be bought without a pointer. Equip (plain `onClick`)
and Rebirth (plain `onClick`) DO work by keyboard — only the *purchase* is blocked.

Refutation (re-drove the flow, seed `taw.wins=500`, focused the first `button.shop-hold`
"Hold to buy for 90"):
- **Enter** pressed → wins stayed `500`, no `.shop-reveal`.
- **Space** held 600ms then released → wins stayed `500`, no reveal.
- **Mouse** hold ~700ms (control) → wins `500 → 410`, purchase committed.
Survives refutation. There is no alternate keyboard buy path.

Fix direction: add a keyboard path to `HoldBuy` — e.g. `onKeyDown` on Space/Enter to
`start()` and `onKeyUp` to commit/cancel (mirroring the pointer hold), or treat a plain
`click` (Enter/Space) as an instant buy. Keep the pointer hold as-is.

**No other screen has an unreachable primary control.** Mode cards, PLAY, JOIN, pack pills,
stats tabs, COPY SAVE / RESET, Rebirth, solo PLAY / Exit / restart, Join-Room inputs are all
in the tab order and activatable by keyboard (verified).

---

## MEDIUM

### MED-1 — Mode dialogs don't manage focus  *(refutation-tested)*
The Word Bomb / Category Blitz mode dialog (`role="dialog"`, `aria-modal="true"`):
- Does **not move focus into the dialog on open** — focus stays on the menu; a keyboard user
  must Tab in from the background.
- Does **not trap focus** — Tab walks straight out to the still-focusable menu mode cards
  behind the modal (verified: focus left the dialog within a few Tabs while it was open).
- Escape **does** close it (good), and every dialog button (Close / PLAY / JOIN WITH CODE) is
  reachable — so this is a focus-management defect, not an unreachable control.
Contrast: the **SHOP overlay** does this correctly — focus lands inside on open and Escape
closes it. Bring the mode dialog in line (focus first control on open; contain Tab).

### MED-2 — color-contrast clusters (axe `color-contrast`, serious)
| Screen | Nodes | Elements |
|---|---|---|
| Stats — locked PERSONAL RECORDS cells | 18 | `.rec-label` / `.rec-req` (grey "RAREST WORD" / "ACCEPT A WORD" etc. on panel) |
| Shop — locked theme cards | 4 | `.shop-card-price` + `.shop-card-gap` ("600", "YOU HAVE 500") on dimmed cards |
| Word Bomb dialog | 1 | `.mode-ex-pay > b` — orange `#FF6B3D` "40" payoff number |
| Join Room browser | 1 | `.browser-title` "JOIN ROOM" |
Largest cluster is the Stats locked-record grid (dimmed by design, but still text that must
meet 4.5:1). The dimming/opacity on locked cards is the root cause in both Stats and Shop.

### MED-3 — Lobby: `aria-prohibited-attr` (serious)
`src` Lobby (Create) screen renders `<span class="" aria-label="WORD BOMB">` — an `aria-label`
on a generic, non-interactive `<span>` with no role, where the attribute is ignored/prohibited.
Drop the `aria-label` (put the text in the span) or give the span an appropriate role.

---

## LOW / PASSES

- **Focus rings present site-wide** — first control and mode cards both show a real `3px solid`
  outline on focus (plus the hard box-shadow on nav icons). No missing-focus-ring finding.
- **Menu, Category Blitz PackPicker, Rebirth, SAT briefing, CHAIN/FUSE in-game, CHAIN
  game-over: ZERO axe violations.**
- **PackPicker** — all 15 pack pills are `<button aria-pressed>`, individually tab-reachable
  and toggle by keyboard; SELECT ALL / CLEAR reachable.
- **Solo game-over** (CHAIN, driven to a real timeout via `?soloms=250`) — no violations;
  "PLAY AGAIN · ENTER" is a native button, tab-reachable AND has an Enter-to-restart shortcut.
  Exit is reachable and returns to the menu (no dead-end, no orphan confirm dialog).
- **Mode cards** are keyboard-activatable — Enter on the WORD BOMB card opens its dialog.
- **Stats** — STATS / COLLECTION / ACHIEVEMENTS tab buttons, COPY SAVE, the backup textarea,
  and RESET ALL PROGRESS are all tab-reachable.

---

## Severity summary
| ID | Sev | Finding | Refuted? |
|---|---|---|---|
| HIGH-1 | HIGH | All shop purchases (upgrades/cosmetics/themes) keyboard-unreachable — `HoldBuy` is pointer-only | yes, survives |
| MED-1 | MED | Mode dialogs: no focus-on-open, no focus trap (Escape works) | yes |
| MED-2 | MED | color-contrast clusters (Stats 18, Shop 4, WB dialog 1, Join Room 1) | — |
| MED-3 | MED | Lobby `aria-prohibited-attr` on a `<span aria-label>` | — |

Top priority: HIGH-1 — it blocks a whole feature (spending wins) for keyboard/switch users.
