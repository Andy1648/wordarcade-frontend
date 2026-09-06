# PLAYTEST — the run stack (integration/run-stack)

ONE sitting. Nine branches merged into `integration/run-stack`, each held for this
single test. Ordered so every step exercises the most branches at once. Work top to
bottom; don't skip — later steps assume the earlier setup.

Branches under test (what each owns):
- **feat/run-mode** — the RUN roguelike: rounds → wall → draft loop, LV8 unlock.
- **feat/run-draft-look** — the draft screen: fanned modifier cards + per-mod art.
- **feat/run-wall** — the wall MOMENT: clear-burst / stamp / miss-shake, run-over gap meter.
- **fix/play-backdrop** — graffiti backdrop behind CHAIN / FUSE / WORD BOMB / BLITZ / RUN.
- **feat/ingame-look** — WORD BOMB / CATEGORY BLITZ HUD + board redesign.
- **feat/game-onboarding** — first-run spotlight + one-line rule on each mode.
- **feat/lobby-life-fe** — PublicRoomsScreen (public rooms list has life, not empty).
- **fix/return-bonus** — the "welcome back" reward card + streak.
- **feat/endgame** — unlock ladder, menu XP bar, shop endgame items.

Preview URL: _(fill in the integration/run-stack Vercel preview)_

Console warps you'll use (open DevTools console on the preview, paste, reload):
- **Warp to LV8 (unlocks RUN):** `localStorage.setItem('taw.xp', JSON.stringify({lv:8,into:0})); location.reload()`
- **Trigger the return bonus:** `localStorage.setItem('wa_last_seen', String(Date.now()-2*24*3600*1000)); localStorage.removeItem('taw.returnClaim'); location.reload()`
- **Full reset (fresh stranger):** `localStorage.clear(); location.reload()`

---

## 1. COLD FIRST LOAD — onboarding + menu endgame chrome
**Branches: game-onboarding, endgame**
Do: run the **Full reset** warp. Land on the menu.
Should: a first-run MENU spotlight appears once and dismisses on the first key/click.
The menu XP bar / level chip renders; REBIRTH and the XP caption are HIDDEN (no wins yet).
Broken if: no spotlight ever shows, OR it shows every reload (should be once ever), OR the
XP bar is missing, OR REBIRTH shows at level 1 with zero wins.

## 2. FIRST GAME COLD — CHAIN or FUSE with onboarding + backdrop
**Branches: game-onboarding, play-backdrop, run-mode (menu card layout)**
Do: from the menu open **CHAIN** (or FUSE if CHAIN is still level-gated). Start playing.
Should: a one-line rule / spotlight explains the mode on the first play. Behind the board
is the graffiti backdrop — the play screen is NOT a flat black hole. Type a valid word, it's
accepted with the usual juice.
Broken if: the rule never appears, the screen is flat black behind the board, or the backdrop
scrolls/animates/flickers (it must be static).

## 3. WORD BOMB — new in-game look + backdrop
**Branches: ingame-look, play-backdrop, game-onboarding**
Do: back to menu, open **WORD BOMB**, start a solo/bot round.
Should: redesigned HUD (countdown, fragment, wins tally) reads cleanly; graffiti backdrop
sits behind it; the WB countdown behaves (no freeze at 0). First-run rule shows once.
Broken if: HUD overlaps itself, countdown sticks or double-fires, backdrop covers the HUD, or
the fragment/board is unreadable against the backdrop.

## 4. CATEGORY BLITZ — in-game look + backdrop
**Branches: ingame-look, play-backdrop**
Do: open **CATEGORY BLITZ**, play a round.
Should: same redesigned HUD family; backdrop behind; category prompt and entries legible.
Broken if: layout breaks, or contrast against the backdrop fails.

## 5. UNLOCK + ENTER THE RUN — the headline
**Branches: run-mode, play-backdrop, endgame (unlock ladder)**
Do: run the **Warp to LV8** console line. On the menu, THE RUN card should now be unlocked.
Open it.
Should: navigates straight into RUN (no room create/join — it's solo, like SAT RUSH). You see
the **wall preview** (the target you must clear) with the graffiti backdrop behind it.
Broken if: THE RUN is still locked at LV8, opening it asks to create/join a room, or it lands
on a black screen.

## 6. PLAY A RUN ROUND → DRAFT → CLEAR THE WALL
**Branches: run-mode, run-draft-look, run-wall, play-backdrop**
Do: play the first round, score enough to clear the wall.
Should: on clearing, the **clear-burst + stamp** fires (a one-shot pop, not a loop). Then the
**draft screen**: THREE modifier cards, fanned, each with its own art + a legible name and a
green upside / red downside trade-off line. Pick one.
Broken if: the wall clear has no moment, the draft shows a plain list instead of fanned art
cards, card text is clipped, or the trade-off line is missing/garbled.

## 7. DIE ON THE WALL — the run-over moment
**Branches: run-wall, run-mode, feat/endgame (wins credited)**
Do: keep playing until you MISS a wall (or intentionally underperform one round).
Should: the **miss-shake** fires, then a run-over screen showing the round reached, the wall
you missed by (a frozen red gap meter), wins earned, and the built modifier stack. A clear way
to RUN AGAIN.
Broken if: dying drops you to a black screen or the menu with no summary, the gap meter is
missing, or RUN AGAIN doesn't restart a run.
_(Note: the dedicated game-over polish is JOB 4 / feat/run-gameover — not in this stack. Judge
only that the run ENDS cleanly and shows the basics here.)_

## 8. MULTIPLAYER LOBBY — public rooms have life
**Branches: lobby-life-fe**
Do: from the menu, go to the public rooms / browse screen.
Should: the screen has life — room cards / states render, not a dead empty panel. Joining a
listed room (or the empty-state copy when none exist) reads intentionally.
Broken if: the browse screen is blank, throws, or the join flow errors.
_(Two-device: on a second device CREATE a public room, confirm it appears in the list on the
first device. This also re-runs the Tier-1 create/join regression — see below.)_

## 9. THE RETURN BONUS — welcome back
**Branches: return-bonus**
Do: run the **Trigger the return bonus** console line, reload.
Should: a "welcome back" card appears once with a wins reward sized to the absence; dismissing
it banks the wins and it does NOT reappear on the next reload (same calendar day).
Broken if: no card, the card reappears every reload, or it grants zero / absurd wins.

## 10. ENDGAME CHROME — ladder, XP, shop
**Branches: endgame**
Do: with level now 8+, open the SHOP and the STATS/menu XP.
Should: the unlock ladder reflects reached levels (cosmetics granted idempotently); the menu XP
bar shows progress; shop shows its endgame items.
Broken if: the ladder is empty/wrong for the level, XP bar is missing, or shop throws.

---

## TIER-1 REGRESSION (required — any App.jsx/WS path was touched by lobby-life-fe)
Two devices, both hard-refreshed on the preview:
1. Device A CREATE ROOM. Device B JOIN by code.
2. Device A START Word Bomb. **Both** devices enter the game — no freeze, no dark screen, the
   non-host is NOT kicked back to waiting.
3. Play one valid word on each device; confirm the turn passes correctly.
4. Console on one device: 0 red errors, 0 key-collision warnings.
If any of these fail, that's the regression — it outranks every cosmetic finding above.

## WHAT "GOOD" LOOKS LIKE
Every play screen has a backdrop (no black holes). Every mode teaches itself once. THE RUN is
reachable in a first sitting, its wall has a moment, its draft is a fanned hand of real cards,
and dying makes you want to go again. Multiplayer create/join still works. The menu shows you
climbing (XP, ladder, shop) and welcomes you back.
