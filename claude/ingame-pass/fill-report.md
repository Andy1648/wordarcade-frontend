# fix/game-fill — game screens fill the viewport (follow-up on fix/ingame-pass)

The lower-half fix revealed the real problem: the game views inherit `.view-screen`'s
`zoom: var(--app-scale)`, which drops to **0.6** at short heights (height-capped) and shrinks
WIDTH with it. Combined with each stage's `max-width`, the solo card rendered a narrow centred
column — CHAIN at 1280×551 was **456px, 35.6% width fill** (exactly the report).

## 1. Width fill measured — stage vs viewport (`claude/_tools/measure-fill.mjs`)

Measured element per screen: WB/BLITZ `.game-stage`, CHAIN/FUSE `.solo-root`, SAT `.sr-stage`
(the poster). All values are `width / innerWidth`.

| viewport   | WORD BOMB | BLITZ | CHAIN | FUSE | SAT (poster) |
|------------|-----------|-------|-------|------|--------------|
| **BEFORE** |           |       |       |      |              |
| 1920×1080  | 75.7%     | 75.7% | 41.1% | 41.1%| 50.5%        |
| 1568×675   | 57.9%     | 57.9% | 31.5% | 31.5%| 38.6%        |
| 1366×768   | 70.1%     | 70.1% | 41.1% | 41.1%| 50.3%        |
| 1280×551   | 57.0%     | 57.0% | 35.6% | 35.6%| 43.7%        |
| **AFTER**  |           |       |       |      |              |
| 1920×1080  | 75.7%     | 75.7% | **96%** | **96%** | 50.4%     |
| 1568×675   | 57.9%     | 57.9% | **96%** | **96%** | 38.6%     |
| 1366×768   | 70.1%     | 70.1% | **96%** | **96%** | 50.3%     |
| 1280×551   | 57.0%     | 57.0% | **96%** | **96%** | 43.7%     |

CHAIN/FUSE: **31–41% → 96%** at every viewport (height fill 95.6–97.8% too). WB/BLITZ/SAT
unchanged — see the scope note below.

## 2. What capped the width, and the fix

- **The `.view-screen.app-scale` zoom** (0.6 at short heights) was the primary shrink, and it is
  an *ancestor* zoom — the exact thing menu-fill forbids (it breaks per-browser). CHAIN/FUSE are
  now **exempt** from it (App.jsx), like the menu / shop / stats.
- **`.solo-root max-width: min(94vw, 760px)`** capped the column. Raised to `min(96vw, 1900px)`
  so the bordered frame fills the window like `.homepage-stage`. The `/var(--app-scale)` height
  calcs (which compensated for the removed zoom) are gone.

## 3. Breathe, not stretch — two-column landscape

Filling a wide-short viewport with a portrait column would just stretch a frame around a small
cluster. Instead `SoloShell` now splits into **two columns at wide aspect** (clock + hero letter |
input + chain/cords), single column on portrait/phones. This fills the width AND needs less height
(so 1280×551 and 1568×675 fill instead of shrinking). Content scales up with the viewport — the
clock ring `15vmin→24vmin` (to 300px), the hero letter cap `76px→240px`, the input taller, the
chain nodes bigger — so the gated solo modes now read BIGGER than the free ones, per the brief.

## 4. Gate extended — `e2e/game-fill.spec.js`

Mirrors `menu-fill`: `.solo-root` must fill **≥90% of both axes** with **no ancestor zoom**, for
CHAIN and FUSE at 1920×1080 / 1600×900 / 1568×675 / 1366×768 / 1280×551. **10/10 pass** (all 96%).
This is the guard that was missing (only the menu was gated, which is why the column survived).

## Scope note — WORD BOMB / BLITZ / SAT keep the zoom (honest)

These three **cannot** be made to fill without the same zoom, and it isn't safe to force in this
pass — proven empirically (removed their zoom, measured):

- **WORD BOMB / BLITZ** overflow their height when unzoomed: `.game-stage` fill-height hit **131%
  (1568×675) / 145% (1280×551)** — the tall stack (player bars + bomb + combo + used-words + input)
  literally does not fit a 551px window without the compression the zoom provides; the top/bottom
  of the live game get clipped. They are also **Tier-1 live multiplayer**.
- **SAT RUSH** clips its clue sentence at 1280×551 when unzoomed (the second line is cut). Its
  poster is a fixed-proportion artifact on a board — the **board (`.sr-app`) already fills the
  viewport**; the poster is content on it (and IS bigger at short heights than it looks, since the
  board carries the fill). Widening the poster to 90% overflows its height at short viewports.

Converting each of these to a zoom-free fill needs a per-screen height-fit redesign (arrange the
content to fit a 551px window natively, the way solo's landscape now does). For WB/BLITZ that also
requires the REGRESSION CHECKLIST 2-device play-test. Flagged as a follow-up rather than rushed
into the live game screens.

## Gate
- game-fill: **10/10**. lint 0 errors. Full e2e: **1043/1043 pass** (clean run, includes the new
  game-fill gate; no regression from the solo restructure).
