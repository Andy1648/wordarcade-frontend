# REBIRTH LADDER (Stats)

Status: dormant. All file:line refs are origin/main @ 15ece21c.
Flag: `flagOn('rbladder')`, i.e. `?rbladder=1` / localStorage `taw.flag.rbladder = '1'`.

## Research

| Game | What it does | Lesson |
|------|--------------|--------|
| AdVenture Capitalist | Each Angel Investor is +2% profit, and the reset screen shows the angels you will claim. The community rule is "reset when it doubles your angels". [TouchTapPlay: angel investors guide](https://www.touchtapplay.com/adventure-capitalist-guide-to-angel-investors/) · [Steam discussion](https://steamcommunity.com/app/346900/discussions/0/364039531219683031) | Players decide by the NEXT step's gain relative to now, so show that. |
| Cookie Clicker | Prestige level is one number (+1% CpS each) shown before you ascend. [Pocket Gamer: heavenly chips](https://www.pocketgamer.com/cookie-clicker/heavenly-chips-guide) · [Pocket Gamer: ascension](https://www.pocketgamer.com/cookie-clicker/ascension-guide) | One number, climbing. Don't explain the formula. |
| +1 Speed Keyboard Escape (Roblox) | The rebirth button shows exactly what you get, one multiplier, and speed is visibly a stack. [allthings.how guide](https://allthings.how/1-speed-keyboard-escape-how-to-build-speed-farm-wins-and-rebirth/) · [bloxodes: rebirths](https://bloxodes.com/wiki/1-speed-keyboard-escape/rebirths) | Past → now → next as chips reads at a glance. |

## Copy (one row of chips, every number via `formatMult` / `formatNum`)

```
BASE ×1   R1 ×2   [ R2 ×3 ]   R3 ×4 · LV 40 · +33%
```

- Past chips are flat cyan `#2EFFE0` with a darker cyan outline.
- The NOW chip is pink `#FF4FA3` with a hard black offset shadow.
- The NEXT chip is yellow `#FFE94A` and shows the gate level and the `+N%` step gain. It's the only
  chip with a %.
- Show at most **4 chips plus one `…`**: `BASE`, `…` if needed, NOW-1, NOW, NEXT. At R0 it's `BASE ×1` (NOW) and
  `R1 ×2 · LV 15 · +100%`.
- There's no label row. The section heading (MENU TYPING XP) and the row it replaces already give the context.

## Where

Stats → the MENU TYPING XP block (`StatsScreen.jsx:367`). It **replaces** the bare `['REBIRTH', x(rbMult)]` row
(`StatsScreen.jsx:203`) with the chip row in the same slot. No new section, no new screen, no
fixed UI. The chips wrap at 360 px; each chip is ≥ 44 px tall but not tappable.

## Trigger

Renders whenever Stats renders and the flag is on. It's static: no animation at rest, and no
hover effect, because the chips aren't buttons.

## Data

| Input | Source |
|-------|--------|
| rebirth count | `getRebirths()` `xp.js:245` |
| multiplier for any count | `rebirthMult(rc)` `xp.js:305` (v9: `1 + rc`) |
| next gate (honours the grandfathered gate) | `rebirthThreshold(rc)` `xp.js:297` |
| table gate (for the greyed chip after NEXT, if ever shown) | `tableRebirthThreshold(rc)` `xp.js:265` |
| step gain | `rebirthMult(rc+1) / rebirthMult(rc) - 1`, the same formula ShopScreen prints at `ShopScreen.jsx:405` |

## Numbers (today's v9 values; the chips read the functions, so v11 changes flow through)

| R | ×mult | gate LV | step gain |
|---|-------|---------|-----------|
| 1 | ×2 | 15 | +100% |
| 2 | ×3 | 25 | +50% |
| 3 | ×4 | 40 | +33% |
| 5 | ×6 | 75 | +20% |
| 10 | ×11 | 200 | +10% |
| 20 | ×21 | 600 | +5% |

**Economy impact: none.** It's display only.

## Simplest version

Three chips: `BASE ×1`, NOW, NEXT. Add the `…` and NOW-1 chip only if Andy wants the history.

## Risks

- **v11 (feat/pv11) is re-tuning rebirths** (one of the 4 knobs). The chips must call `rebirthMult`
  / `rebirthThreshold`, never copy the table, or they'll disagree with the Shop's rebirth line
  (`ShopScreen.jsx:405`, which is in v11's scope). Ship after v11 merges.
- **The shrinking % is honest but deflating** (+100% → +5%). That's an economy question for v11, not
  a UI one. Don't hide the % to dodge it (#3 NUMBERS MAKE SENSE).
- **Huge multipliers.** `formatMult` already hands ×1e11 to `formatNum` (`StatsScreen.jsx:45`).
