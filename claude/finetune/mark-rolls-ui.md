# MARK ROLLS UI — reveal (H1 quality protocol: decided)

Branch `feat/mark-rolls-ui` (PR #156). The first pass shipped three reveals on one build (`?mrv=a|b|c`:
A FLIP, B REEL, C STAMP). The oct3 adversarial review picked a **hybrid on version A**. B, C and the
`?mrv=` switch are deleted. Timelines: `src/components/markRolls/revealTimelines.js`. Lengths and hold
pacing: `revealPlan.js`. Both are unit-tested.

## What shipped (the hybrid)

| tier | length | reveal |
|---|---|---|
| COMMON | 300 ms | A's flip: the face-down coin squashes shut, then the result card opens with a small overshoot |
| RARE | 700 ms | A's wobble: the coin wobbles and swells over three beats, a tier flash hits, then the flip |
| EPIC | 2.2 s | the cutscene below |
| LEGENDARY | 2.5 s | the cutscene below, one more ladder bar |

**The cutscene.** It runs on the dark plate over the MARKS panel, portalled into the overlay (not a new
fixed element).
1. The tier ladder climbs: one bar per tier below the result, 220 ms apart.
2. The **final tier** lands at `--fs-hero` in its own colour.
3. The **mark's art + NAME** appear big.
4. **"1 IN X"** stamps at `--fs-hero` (capped at 10vw so "1 IN 10,000" fits at 390).
5. The plate fades while the result card flips open in the panel.

**Rules the code keeps:**
- Finite WAAPI steps on a fixed node pool, transform/opacity only. `will-change` is on only while a reveal
  plays, and nothing is measured.
- Every node that flips to zero width also fades to opacity 0 (unit-tested). That is the fix for the stray
  "dot" in the shots: a coin at scaleX ≈ 0.05 with its black drop-shadow circle.

**Reduced motion:**
- Common and rare show the static card.
- Epic and legendary show their plate (tier, art, name, "1 IN X") as ONE static frame for the same hold.
  Rarity still reads.

## Interaction fixes from the review

- **No spoilers.**
  - The index, % COLLECTED, pity and an auto-equipped MAIN change only when the reveal lands or is
    skipped.
  - MarksIndex snapshots storage on mount and on each landing (`landed`), never on re-render.
  - Homepage passes a stable `unlockedIds`.
  - The equip is applied by `applyRollEquip` at the landing, not inside `buyMarkRoll`.
- **Equip.** Any higher MAIN auto-equips (always when nothing is worn). There is no prompt, so a hold
  never stalls.
- **Fixed-height stage.** No EQUIP row, so the ROLL button never moves under the cursor.
- **Short balance.** The press shows `NEED X MORE WINS` and buzzes (a sound plus a 240 ms shake), and a
  hold that runs dry stops with that line.

## Left for Andy

- Re-shoot 1280×800, 1280×551 and 390×844: a common, a rare, and a forced epic/legendary (seed
  `taw.markRolls` with `sinceEpic: 39, everEpic: true`). Also a reduced-motion epic.
- Run `e2e/mark-rolls.spec.js` (rewritten for the hybrid, not run), `e2e/marks.spec.js`,
  `e2e/shop-hold.spec.js` and the payload specs.
