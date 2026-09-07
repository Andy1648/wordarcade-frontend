# Stranger test 4 — the new on-ramp (fix/onramp), fresh LV1 first 60 seconds

Re-run of the STRANGER WALK on `fix/onramp`, which changed the new-player on-ramp:
(1) Word Bomb / Category Blitz **PLAY** now starts a SOLO game instantly (vs a bot for
Word Bomb); multiplayer is a secondary INVITE FRIENDS / JOIN WITH CODE row. (2) THE RUN
card is a FREE first run for a brand-new account (playable, not a LV8 padlock); the gate
engages only after the first run is actually played.

Storage cleared before first paint = real brand-new LV1 account (no level warp, no
`taw.runFreeUsed` flag). Walked at two REAL viewports and screenshotted every screen in order.

- Script: `claude/_tools/stranger-4-walk.mjs` — spins its own `vite preview`, imports the
  SAME e2e boundary as the suite (`e2e/support/backendMock.js` → `installBackendMock`:
  `waitForSent` + `pushToClient`), so the walk is deterministic and hits no real server.
- Shots: `claude/stranger-4-shots/phone-390x844/` and `.../laptop-1366x768/` (10 each,
  numbered in walk order; `03b-run-card-closeup.png` is the RUN hero card alone).
- Backend never contacted (WS intercepted, all non-localhost HTTP blocked).

Compare against `git show origin/chore/stranger-3:claude/stranger-3.md`, whose two named
tab-closers were: the flagship PLAY funneling a solo player into "SHARE THIS CODE WITH
FRIENDS / NEED 2+ PLAYERS", and the RUN hero being a grey padlock.

---

## Are the two blockers GONE? YES — both.

### (a) Does PLAY start a solo game with no "need 2+ players" lobby? — GONE.

- **Word Bomb dialog leads with a big full-width PLAY button**; INVITE FRIENDS + JOIN
  WITH CODE are a small white two-up secondary row beneath it — visually, unmistakably
  the secondary choice. (phone `06`, laptop `06`)
- **Clicking PLAY drops straight into a LIVE game**: YOU (3 hearts) vs BOT (3 hearts),
  YOUR TURN, bomb ticking, "TYPE A WORD CONTAINING STR", SEND/SKIP. No room code, no
  "SHARE THIS CODE WITH FRIENDS", no "NEED 2+ PLAYERS". (phone `07`, laptop `07`)
- Under the hood the client provisions solo-vs-bot on one socket:
  `create_room → set_game_type → (set_difficulty) → add_bot → start_game`, and a
  `room_update` arriving mid-provision does NOT flash the lobby (guarded by
  `soloLaunchRef` in App.jsx). This exact order + "never lands on `.room-wrap`/`.lobby-wrap`"
  is also asserted programmatically by the shipped test `e2e/mode-dialog.spec.js`
  ("on-ramp: Word Bomb PLAY provisions solo-vs-bot and lands in-game (no lobby)").
- **Category Blitz is the same pattern** — big blue PLAY leads, INVITE FRIENDS / JOIN WITH
  CODE secondary, plus the pack picker. (phone `08`)
- The menu even labels both cards **"SOLO/MULTI"** now, signalling up front that you can
  play alone. (phone/laptop `05`)

### (b) Is the RUN hero playable, not a padlock? — GONE.

- On the cold LV1 menu THE RUN is the **first, biggest, FULL-COLOUR card** ("ROGUELIKE /
  THE RUN / 10 ROUNDS · DRAFT · BEAT THE WALL", ×4/×3/×5 art) — no lock plaque, no
  "UNLOCKS AT LV 8". (phone `05` + `03b` closeup; laptop `05`) This is the direct
  inversion of stranger-3's grey-padlock hero.
- **Clicking it enters the run**: the live wall preview — "ROUND 1 / 10 · CLEAR 225 OR THE
  RUN ENDS · SAT RUSH · START ROUND 1" with the ante ladder 225→12k. Not a read-only
  locked preview. (phone `09`, laptop `09`)
- The freebie is only spent when a round actually STARTS (`runGate.js` +
  `useRunMode` `markFreeRunUsed`), so opening the wall and backing out does not burn it.
- Only CHAIN (LV20) and FUSE (LV25) remain padlocked — intentional per
  `runMode/config.js`; they now sit at the END of the grid, not as the hero.

Automated assertions in the walk (RUN card has no `.game-card-lock`; PLAY sits above +
wider than the MP row; `start_game` sent after `add_bot`; `.game-stage` visible with
`.room-wrap`/`.lobby-wrap` == 0) all held at both viewports — but the screenshots above
are the direct proof.

---

## The NEW first 60 seconds (blunt), vs stranger-3

Stranger-3: "this needs friends I don't have, and most of it is locked" — flagship PLAY →
share-a-code lobby, hero card a grey padlock.

Now: **you land on a menu whose biggest card is a playable, obviously-exciting roguelike,
tap it or any mode's PLAY, and you're instantly IN a game — solo, no code, no waiting.**
The first minute now reads as "here's a game I can just play," and multiplayer is there
as a deliberate INVITE/JOIN choice rather than a wall you have to escape. The single
biggest first-impression fix from stranger-3 has landed on both blockers.

---

## NEW confusion the on-ramp could introduce / still unfinished in the first minute

1. **The free-run → then-locked flip is the one genuinely new thing to watch.** After a
   newcomer plays their one free run and returns to the menu, the hero card becomes a
   "UNLOCKS AT LV 8" padlock — the exact card that was playable 10 minutes earlier. It
   does show "YOU'RE LV n · x TO GO" so it reads as reachable, but a first-timer may still
   feel a small bait-and-switch ("wait, I was just playing this"). Not observed as broken
   (the walk deliberately didn't burn the freebie), but it's the transition most worth a
   live gut-check. A one-line "that was your free run — reach LV8 to unlock it for good"
   note on the card/over-screen would defuse it.
2. **INVITE / JOIN discoverability is fine, arguably over-served.** The two white
   secondary buttons are clearly visible under PLAY, AND the menu still carries its own
   bottom "JOIN ROOM" button — so joining a friend is reachable two ways. No risk of a
   social player feeling shut out.
3. **Pre-existing (NOT on-ramp) items from stranger-3 still stand:** the unexplained
   economy ("40 / 20 / 10 WINS / WORD", "0 WINS", "M1 MASTERY — PLAY TO LEVEL UP") is
   still unexplained on the cards/dialogs (phone `05`,`06`,`08`); and the in-game yellow
   coach heading "TYPE A WORD WITH THE LETTERS" still overlaps the used-words/input band
   (phone `07`). These aren't regressions from this branch — they're the same notes
   stranger-3 raised, untouched here.

## Verdict

Both stranger-3 tab-closers are fixed. (a) PLAY on Word Bomb and Category Blitz starts a
live solo game (vs a bot for Word Bomb) with no share-code lobby; (b) THE RUN hero is a
playable full-colour card that enters the run, not a padlock. The one thing to watch that
this branch newly introduces is the free-run→locked flip on the hero card after the first
run; everything else that still confuses a newcomer (wins economy, mastery, in-game coach
overlap) predates this branch.
