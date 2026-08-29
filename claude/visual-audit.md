# VISUAL AUDIT — screen by screen (JOB 2)

Date: 2026-08-29. Branch: `chore/visual-audit`. Off `main`.

First audit that actually LOOKS at the game rather than measuring geometry. 87 screenshots
(29 screens/states × 3 viewports: 1920×1080, 1366×768, 390×844) in `claude/shots/<screen>/<vp>.png`.
Contact sheets: `claude/shots/_contact-<vp>.png` (+ `.html`).

Captured: splash, menu, 4 mode dialogs (word-bomb/blitz/chain/fuse), 2 locked previews
(chain/fuse), shop + shop-bottom + rebirth + rebirth-confirm, stats/collection/achievements
(stats-1/2/3), credits, lobby, room, browser, 4 in-game (WB/CB/chain/fuse), 4 game-over,
SAT briefing + mode-select. (Pack picker = dialog-category-blitz.)

Method note: game screens are driven by mocked WS frames whose player id does not match the
client's assigned id, so the WB/CB in-game shots render the **dimmed "not your turn" state** — a
capture artifact, NOT a bug. Where that matters it is called out.

---

## RANKED SUMMARY (worst first)

No hard-BROKEN visual defect was found — the existing `viewport-integrity` gate already blocks
clipping/overflow/off-screen, and every screen fits. The real damage is **systemic
inconsistency**: the design system has drifted into two of everything.

| # | Rank | Finding | Evidence |
|---|------|---------|----------|
| 1 | INCONSISTENT | Two brand pinks: `#ff2ec4` (86 uses, menu+game) vs `#ff4fa3` (12, newer overlays) | grep; menu vs shop shots |
| 2 | INCONSISTENT | Two panel backgrounds: `#1a0b2e` (72 uses) is the de-facto panel; the intended `#160f28` is used **once** | grep |
| 3 | INCONSISTENT | ≥5 distinct danger reds with no token: `#ff5c5c`(27) `#ff4b4b`(13) `#ff3b3b`(6) `#ff2e2e`(4) `#ff3b3b`… across ShopScreen/StatsScreen/Solo | grep |
| 4 | INCONSISTENT | ≥8 distinct muted-lavender text shades, no token: `#c9b8e8` `#b9a7d6` `#d8c9f0` `#9a8bbf` `#cdbdf0` `#c8b8e0` `#8a7bb0` `#6b5a86` | grep |
| 5 | INCONSISTENT | Primary-button weight mismatch: `shop-card-btn` = 3px border / 6px radius / 2px shadow; every other primary CTA = 4px / 8px / 4px | ShopScreen.css |
| 6 | INCONSISTENT | Close control `lp-close` (locked preview) = `border: none` (no outline/shadow); shop/stats/mode-dialog closes are all 40×40 / 8px / 3px border / 3px shadow | LockedPreviewDialog.css:37 |
| 7 | INCONSISTENT | Primary-button font-size drifts for the same role: homepage `clamp(13,_,18)`, mode-dialog `clamp(16,_,18)`, shop/stats/rebirth `clamp(18,_,20)` | grep |
| 8 | INCONSISTENT | Exit affordance differs by screen: × chip (shop/stats/dialogs) vs "← BACK" (credits/lobby/room name-entry) vs "EXIT" text (SAT) vs "LEAVE" (game-over) for the same "leave" job | shots |
| 9 | POLISH | Desktop in-game (WB/CB) is a narrow centred column in a vast empty field — far emptier than its dense mobile sibling | ingame-word-bomb/1920×1080.png |
| 10 | POLISH | `sat-modeselect` is a tiny "PICK YOUR BEAT" card floating in near-black at every viewport — reads unfinished | sat-modeselect/*.png |
| 11 | POLISH | Shop EQUIP button (yellow) and the coin price chip (yellow) are near-identical — action vs cost don't separate | shop/390×844.png |
| 12 | POLISH | Game-over (blitz) stacks three differently-styled small buttons: SHARE (orange), IMAGE (orange), COPY (dark) | gameover-category-blitz/390×844.png |
| 13 | POLISH | Menu "NEXT" unlock chip bleeds above the top edge of the SHOP overlay | shop/390×844.png |
| 14 | POLISH | Spacing has no scale: ~17 distinct fixed `gap:` values (1–24px) and ~23 distinct `padding:` values (see JOB 4) | grep |

---

## CROSS-CUTTING (the system, not one screen)

### Colour — the palette has drifted into doubles
The intended core palette is pink / yellow / cyan / dark-bg / cream / panel. In the source:
- **Pink is split.** `#ff2ec4` (86×, the CLAUDE.md "canonical" magenta) drives the menu wordmark,
  the game screens, MenuXp. `#ff4fa3` (12×, a softer rose) drives the *newer* overlays
  (ModeDialog, ShopScreen, StatsScreen, CollectionScreen, AchievementsScreen). When an overlay is
  open over the menu, both pinks are on screen at once. Pick one.
- **Panel bg is split.** `#1a0b2e` (72×) is the real panel colour everywhere; `#160f28` appears
  once (`wall-system.css`). If `#160f28` is the intended panel, 71 sites are wrong; if `#1a0b2e`
  is, the token is misdocumented. Either way it's undecided.
- **Danger red is ad-hoc.** At least five reds (`#ff5c5c/#ff4b4b/#ff3b3b/#ff2e2e/#ff2e2e`) do the
  same "danger/leave/lose" job in ShopScreen, StatsScreen and Solo with no shared value.
- **Muted text is ad-hoc.** Eight+ near-identical lavender-greys carry secondary text. One
  `--text-muted` token would collapse them.
- Legitimately off-core (do NOT flag): per-mode accents `#ff6b3d` (bomb), `#9a1aff` (chain/rebirth),
  `#3da8ff` (blitz) and their darker colored-outline shades (`#1a9985`, `#b8a020`, `#991a75`, …) —
  these are intentional mode identity + the "outline is a darker shade of the fill" rule. The SAT
  cream/ink palette (`#f0ead9`, `#c8321e`, `#f3e2be`) is the sanctioned retro-print sub-style.
- Stray neutral: `#aaaaaa` (10×) — an off-palette flat grey; should be a cream/lavender token.

### Buttons — three weights for one role
"Primary action" renders three ways: the 4px/8px/4px heavy pill (homepage, mode-dialog, shop-back,
stats-back, rebirth) is the house standard; `shop-card-btn` is a lighter 3px/6px/2px; and text-size
maxes disagree (18 vs 18 vs 20). Consolidate to one primary-button class. Border-radius is otherwise
healthy — 8px is 122/… of all radii; the notable outlier cluster is 6px (14×, mostly `shop-card-btn`).

### Close / exit — four affordances
Canonical close = 40×40, 8px radius, 3px black border, 3px offset shadow, dark fill, white ✕
(shop/stats/mode-dialog all match — good). Outliers: `lp-close` has `border:none`; and several
non-overlay screens exit via a text "← BACK" / "EXIT" / "LEAVE" instead of the ✕. Decide: overlays
get the ✕, full-page screens get one "← BACK" style — and make lp-close match the ✕.

### Spacing — no scale (feeds JOB 4)
`gap:` alone uses 17 distinct fixed px values (1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24) and
`padding:` ~23. There is no 4/8/12/16/24/32 rhythm; values were picked per-component.

---

## PER-SCREEN NOTES

- **splash** — wordmark on starburst; clean. Uses `#ff2ec4` pink (see #1).
- **menu** — dense, strong. The hub. Pink = `#ff2ec4`. Cards are the 5 modes in mode colours; good.
- **dialog-word-bomb / -chain / -fuse** — consistent structure (chip · title · liner · example ·
  mastery · CTA). Titles large Bungee, skewed; good. CTA = mode-accent pill. Consistent siblings.
- **dialog-category-blitz** — same shell + the pack picker; the "AI JUDGED" badge + PICK YOUR PACKS.
  Denser than the others but coherent. (Blitz blue `#3da8ff` is the mode accent — fine.)
- **locked-chain / locked-fuse** — read-only teaser; ✕ has no border (#6). "UNLOCKS AT LV n" line.
- **shop / shop-bottom** — theme swatch cards → key power → word sense → pop styles → sound packs.
  EQUIP vs price both yellow (#11). Long scroll; the bottom "BACK TO MENU" pill is good.
- **rebirth / rebirth-confirm** — stat rows + LOSE/KEEP/GAIN list. The REBIRTH action is purple
  `#9a1aff`; CONFIRM/CANCEL appear on confirm. Purple action reads distinct — good.
- **stats-1/2/3 (stats/collection/achievements)** — shared tab bar (cyan active) — consistent. Records
  grid, collection tier counts, achievements list. Solid, among the best-finished screens.
- **credits** — small centred card, purple outline. Fine, a touch sparse.
- **lobby / room / browser** — name entry, room code + share, public list. Functional; the room
  "LEAVE ROOM" uses a red (#3). "← BACK" text exits (see #8).
- **in-game WB/CB (desktop)** — emptiness (#9). Mobile is dense and good.
- **in-game chain/fuse** — solo ring timer + prompt; consistent between the two modes.
- **game-over (all four)** — placement/stats card; blitz variant has the 3-button row (#12).
- **sat-briefing** — cream manga "THE BRIEFING" page — sanctioned SAT sub-style, looks deliberate.
- **sat-modeselect** — emptiness (#10); the one screen that reads unfinished.

## What I could not do
- ImageMagick is not installed; contact sheets are HTML→PNG via Playwright instead of `montage`
  (logged in DECISIONS.md). Equivalent output.
- In-game WB/CB shots are the dimmed not-your-turn state (mock player-id mismatch); the emptiness
  finding still holds (layout is turn-independent) but exact live-turn contrast wasn't captured.
