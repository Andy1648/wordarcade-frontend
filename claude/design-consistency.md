# JOB 9 — DESIGN CONSISTENCY AUDIT (chore/design-consistency, report only)

The app has never been compared against itself. This inventories the repeated visual elements and
names every MISMATCH — two things that do the same job but look different — ranked by how visible each
is to a player. (Focused on the highest-frequency repeated elements; specs are from the shipped CSS on
`main`. No code changed on this branch.)

## Inventory + variants

### 1. Close / exit ✕ controls — **4 variants** (every overlay has one)
| Element | file:line | size | bg | border | shadow | radius | font |
|---------|-----------|------|----|--------|--------|--------|------|
| `.stats-close` | StatsScreen.css:52 | 40×40 | #0d0618 | 3px #000 | 3px 3px | 8px | 16px |
| `.shop-close` | ShopScreen.css:64 | 40×40 | #0d0618 | 3px #000 | 3px 3px | 8px | 16px |
| `.mode-dialog-close` | ModeDialog.css:77 | **38×38** | **#fff** | 3px #000 | **none** | 8px | — |
| `.solo-exit` | Solo.css:40 | **44×44** | **#1a0b2e** | 3px #000 | 3px 3px | 8px | — |

→ stats + shop agree; **mode-dialog** (smaller, white, no shadow) and **solo-exit** (bigger, panel-bg)
diverge. Three visibly different ✕ buttons for one job.

### 2. Primary action button — **3+ variants**
| Element | file:line | height/pad | bg | border | radius | font |
|---------|-----------|-----------|----|--------|--------|------|
| `.stats-back` | StatsScreen.css:127 | pad 12px | #2effe0 (cyan) | 4px #000 | 8px | clamp(18,20) |
| `.solo-restart` | Solo.css:447 | **52px** | **#3a2b52 (purple)** | 4px #000 | 8px | 18px |
| `.mode-dialog-btn-create` | ModeDialog.css:~310 | — | **#fff / accent** | (darkened accent) | 8px | Bungee |
| `.coll-back` / `.ach-back` (built this run) | — | pad 12px | #2effe0 | 4px #000 | 8px | clamp |

→ The **shape language is consistent** (4px border, 8px radius, hard offset shadow, Bungee). The
**fill color and height vary**: cyan vs purple vs white/accent, 52px vs padding-sized. Some of that is
intentional (mode buttons carry the mode accent), but stats/coll/ach (cyan) vs solo-restart (purple)
is an unjustified split for the same "confirm / back" role.

### 3. Progress bars — **3 variants**
| Element | file:line | height | border | radius | track |
|---------|-----------|--------|--------|--------|-------|
| `.shop-progress` | ShopScreen.css:451 | 8px | 2px #000 | 6px | #0a0414 |
| `.coll-milestone-track` (this run) | — | 12px | 2px #000 | 8px | #2a1f3d |
| `.mastery-track` (this run) | ModeDialog.css | 9px | 2.5px #000 | 6px | rgba |

→ Heights 8/9/12, radii 6/8, track colors all differ.

### 4. Chips / badges / pills — **3+ variants**
| Element | file:line | border | radius | bg | shadow |
|---------|-----------|--------|--------|----|--------|
| `.mode-dialog-chip` | ModeDialog.css:167 | 2px currentColor | 6px | rgba(0,0,0,.35) | none |
| `.game-card-badge` | GameCard.css:371 | 2.5px rgba | (none) | inline | none |
| `.game-card-ai-badge` | GameCard.css:356 | 3px #000 | 10px | #2EFFE0 | 3px 3px |
| `.game-card-mastery` (this run) | GameCard.css | 2px rgba | 6px | #2EFFE0 | 2px 2px |

→ Border 2 / 2.5 / 3px; radius 6 / 10 / none; some have a hard shadow, some don't.

### 5. Overlay panels — **mostly consistent**
`.stats-panel` / `.shop-panel` / `.coll-panel` / `.ach-panel`: all 4px #000 border, 8px radius, **8px
8px 0 #000** shadow, #1a0b2e bg. `.mode-dialog-shell` differs (colored border = mode accent, its own
shadow). The overlays built as a family are consistent; ModeDialog is the outlier (intentional-ish).

### 6. Shadow offsets — **semi-systematic, not tokenized**
8px8px (panels) / 6px6px (menu cards) / 4px4px (buttons) / 3px3px (close). Roughly "bigger element →
bigger shadow," which reads okay, but the values are hardcoded in ~20 places with no token, so drift
is easy (the featured card is 7px7px, an off-ladder value).

## Mismatches, ranked by visibility to a player
1. **Close ✕ control (4 variants)** — on EVERY overlay the player opens; the white 38px mode-dialog ✕
   next to the dark 40px stats ✕ is the most-seen inconsistency. **Highest.**
2. **Primary button fill: cyan vs purple** (stats/coll/ach vs solo-restart) for the same confirm/back
   role. High — both are big, central buttons.
3. **Chip/badge border+radius+shadow** (2/2.5/3px, 6/10/none) — visible on the menu cards + dialogs.
4. **Progress-bar height/radius/track** (8/9/12px) — shop vs collection vs mastery, side-by-side in
   the shop-adjacent flows.
5. **Shadow-offset drift** (7px7px featured card off the 6px ladder; no tokens) — subtle but compounds.
6. **ModeDialog is the app's odd overlay** (white close, colored border, its own shadow) vs the
   stats/shop/coll/ach family — medium (dialogs are frequent).
7. `.mode-dialog-chip` radius 6 vs `.game-card-ai-badge` radius 10 — the two "AI/label" pills differ.
8. Border widths across similar elements: 2 / 2.5 / 3 / 4px with no rule (thin chip vs thick panel is
   fine, but 2 vs 2.5 on sibling chips is drift).
9. Input fields: `.solo-input` vs the Word Bomb input vs name inputs — different padding/border (not
   fully tabled here; flagged for the fix pass to measure).
10. Empty states: `.browser-empty` (PublicRooms) vs `.coll-empty` (Collection) — different type scale
    and spacing for the same "nothing here yet" role.

## Recommendation
Introduce a small set of **shared tokens** (`--ctl-close-*`, `--btn-primary-*`, `--chip-*`,
`--shadow-1/2/3`) and consolidate each element to one variant. The **top 10 above** are the fix set
for the `fix/design-consistency` branch; per-mode ACCENT COLORS are the one dimension that should stay
varied (that's identity, not drift).
