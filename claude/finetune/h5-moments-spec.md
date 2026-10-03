# H5 — important = announced: ONE queue for every big moment (spec, oct3 03:00)

## Today (measured in code)
The menu's moments are kept apart by hand-tuned timers that each know about the others:
- RankUpMoment waits `RANKUP_DELAY_MS = 1600` "after the 1.5 s level-up card".
- the wall fx waits `wallWait()` (1.8 s after mount), and the tier-up card is pushed by `wallWait()+1850`.
- TutorialHost polls a 13-selector BUSY list every 1 s, plus `data-wallfx`.
- ClaimPopup, WinsCreditToast and the level-up/tier-up card in MenuXp have no coordination at all.
Every new moment (H3: purchases, rebirth, code redeem, FRENZY/BOOST start/end, the multiplayer WIN) would add
another timer guess. The guesses already collide (the cold-load wall vs tier-up vs arrival wipe needed a fix tonight).

## Three versions
- **V1 — ORDER-ONLY QUEUE (chosen).** `src/lib/moments.js`: `announce({id, priority, maxMs, start(done)})`.
  The queue owns order only; each moment keeps its own art and calls `done()`. One heavy moment at a time,
  220 ms gap, priority (WIN > LEVEL > REWARD > INFO > TUTORIAL), dedupe by id, maxMs safety release,
  counted `hold()` for panels/games. Migrates one moment at a time with no visual change.
- **V2 — ONE RENDERER (`<MomentHost>` draws every card from data).** The most consistent look, but every
  existing moment's art is rewritten at once — a big-bang change touching MenuXp's WAAPI level-up, the
  wall stamp and the tutorials together. Rejected for now; V1 can grow into it (a `start` that renders into a
  shared host) moment by moment.
- **V3 — CSS-only stagger (data-attr per moment, fixed delays).** No code, but it is the timer-guessing we
  have today, written in CSS. Rejected.

## Rules (H3 + H5)
- Never two heavy moments at once. Light feedback (word pops, +WINS stamps) is NOT queued — it must stay
  under 50 ms from the keystroke.
- A moment that loses its callback is released after maxMs; a moment that throws is released at once.
- Panels (stats, shop, board, claims, marks, mode dialog) and games call `hold()`; nothing new starts under them.
- Reduced motion: the queue is unchanged; each moment shows its static card for the same time.

## Migration order (one moment per commit, each with its e2e)
1. Tutorials: TutorialHost announces at PRIORITY.TUTORIAL instead of polling BUSY.
2. RankUpMoment: announce at PRIORITY.LEVEL; drop RANKUP_DELAY_MS.
3. Wall fx + tier-up card: announce at PRIORITY.LEVEL (wall first); drop `wallWait()+1850`.
4. ClaimPopup: announce at PRIORITY.REWARD.
5. New H3 moments go straight onto the queue: purchase, rebirth, code redeem, FRENZY/BOOST start/end, the WIN popup (H4).
Gated on feat/h2a-board landing (it edits Homepage.jsx too).

## Status
- `src/lib/moments.js` + 9 unit tests: DONE (order, gap, priority, dedupe, lost-callback release, throw
  release, counted hold, cancel, no idle timers).
- Wiring steps 1–4 + panel holds: DONE on feat/h5-wiring (lib/menuMoments.js = kinds/priorities/real
  lengths; lib/useMomentSlot.js = render-while-it's-your-turn + useMomentHold; queue gained `interruptible`
  so the lingering claim popup steps aside for a LEVEL moment and comes back). Also queued: rebirth card
  (LEVEL), mark-upgraded + automation cards (INFO). Step 5 (new H3 moments): pending.
