# H4 — MULTIPLAYER WINNER PAYS A TON (spec)

> Andy: "The winner of WB/Blitz/RACE (any multiplayer match) gets a big payout, clearly bigger than
> solo, plus a big WINNER popup animation with the amount counting up. Losers still get their
> per-word pay. Run the sim so it can't be farmed (min players / min words / no self-join
> exploits). Update every card, dialog and receipt that quotes payouts."

Branch `feat/h4-winner-pays`. Code: `src/progress/payout.js` (`winnerPayout`, `WINNER_MATCH`),
`src/progress/seats.js`, `src/components/WinnerPopup.jsx`. Sim: `claude/finetune/h4-sim.mjs`.

## 1. Research — what pays today, and what the client can see

| mode | how a word pays | winner today | who wins (server) |
|---|---|---|---|
| Word Bomb | per word, `bankWordWins` in `word_result`; folded into the round ledger | **+50%** of the ledger total (`winnerBonusFor`), `noteRoundBonus` dedupes | last player with lives (`gameLogic.advanceTurn`); a leaver is eliminated |
| Category Blitz | per answer, `bankWordWins` in `answer_result`; NOT in the ledger | **nothing** | highest cumulative score; tie → first in player order (`determineWinner`); 0–0 still names a winner |
| WORD RACE | per word, `bankRaceWord` in `race_word_result` | **nothing** | first to 25, or the leader at the 60 s cap / when the field leaves (`forfeit`); nobody scored → no winner |

What the client can **observe** (and so what a gate may use):

- **Bots.** `room_update.players[].isBot` (WB/Blitz roster; humans carry no field) and
  `race_start.racers[].isBot` / `race_over.standings[].isBot` (RACE).
- **Per-player valid words.** WB: every accepted `word_result` is broadcast and App already
  attributes it to a player (own-submit match, else the turn pointer) — H4 adds a per-id counter
  next to the existing `gameStats.wordsPlayed` push. Blitz: `game_over.finalScores[].score` *is* the
  answer count (`roundScore = answers.length`). RACE: `race_over.standings[].words`, kept for leavers.
- **Leavers.** RACE `standings[].left`; WB drops the leaver from the roster, but the per-id word
  count survives; Blitz drops the leaver from `finalScores`, so the rival's words are taken as the
  max of `finalScores` and the per-round `round_end` tallies (`categoryTotalsRef`).
- **Game length.** `gameStartMsRef` (WB/Blitz, stamped at `game_started`), and the `race_start`
  receive time (RACE).
- **My game total.** WB: the round ledger total. Blitz/RACE: summed from the per-word `banked` they
  already return (new per-game refs).
- **Same browser.** Not visible in any frame — so H4 adds `seats.js`: every tab writes its live
  player id into `localStorage['taw.seats']` keyed by a per-tab random id; at game over any rival id
  another tab registered is the player themself.

## 2. Three versions

**(a) MULTIPLIER on the winner's own game total.** `bonus = M[mode] × gameTotal`.
+ Scales with effort and with everything the player built (rarity, combo, rebirth, boost) for free.
+ Short games pay little automatically.
− With nothing else it is farmable in the fixed-length modes: Blitz (always 3 rounds) and RACE
  (always 25 words) let a dummy that types 1 word unlock ×M of a full solo game. Two-tab self-play
  at 20 words/min pays ×M of all of it.

**(b) FLAT words-equivalent at the live rate.** `bonus = perWordRateNow(mode).rate × N`.
+ Always feels big; easy copy ("WIN = 40 WORDS").
− Decoupled from effort: a 5-word, 40-second game pays the same N words → the short game IS the
  farm (dozens of N-word bonuses an hour). Ignores rarity/combo, so a great game and a scrappy one
  pay the same. Needs heavy gating to be safe, and even gated it rewards *ending games fast*.

**(c) HYBRID — chosen.** (a)'s multiplier, with (b)'s "priced in words" idea turned into two
**word-count caps**:
```
counted = min(myWords, CONTEST × bestRivalWords, PACE[mode] × minutes)
bonus   = M[mode] × gameTotal × counted / myWords        (never below the mode's fallback)
```
- `CONTEST = 2`: at most 2 of your words count per word your best human rival played → a dummy
  has to *really* play to unlock the bonus; a normal close match is never touched.
- `PACE[mode]` = a strong honest player's words per minute (WB 8, Blitz 16, RACE 32) → words typed
  faster than a real match (the signature of playing both sides) stop growing the bonus.

**Why (c):** it keeps (a)'s "scales with what you earned" (a won game is ×7 of *your* game, so the
copy is one honest sentence) while the two caps close exactly the two holes (a) leaves. (b) is
rejected because a flat amount makes the shortest game the most profitable one.

### Gates (all observable) and fallback

| gate | fails when | fallback |
|---|---|---|
| I won | `winnerId !== myId` | nothing (losers keep their per-word pay) |
| `myWords ≥ 5` | a 2–4 word game | today's rule, note `MATCH BONUS NEEDS 5+ WORDS` |
| a human rival | every other seat `isBot` | today's rule, note `MATCH BONUS NEEDS A HUMAN RIVAL` |
| not my own tab | the only rival id is in `otherSeatIds()` | today's rule, note `YOUR OTHER TAB IS NOT A RIVAL` |
| rival `words ≥ 3` | AFK seat | today's rule, note `RIVAL PLAYED UNDER 3 WORDS` |

"Today's rule" = `WINNER_FALLBACK`: Word Bomb +50%, Blitz 0, RACE 0 — exactly what each mode paid
before H4, so **no gate can ever pay less than the game did yesterday**, and no bot room gains a
new exploit. A leaver who played ≥ 3 words still counts (a rage-quit is a real win). A re-delivered
`game_over` / `race_over` cannot pay twice: the bonus is noted with `noteRoundBonus({key:'winner'})`
(RACE now opens a ledger at `race_start` for exactly this).

### Size — the table (one source: `WINNER_MATCH` in payout.js)

| mode | M (bonus) | card copy | pace cap |
|---|---|---|---|
| Word Bomb | +6 | `WIN: YOUR GAME ×7` | 8 words/min |
| Category Blitz | +4 | `WIN: YOUR GAME ×5` | 16 words/min |
| WORD RACE | +1 | `WIN: YOUR GAME ×2` | 32 words/min |

Per mode because a minute of each pays very differently (WB is turn-based ~6 words/min at ×2; a
RACE is ~20 words at ×3). Each M is tuned so the **median honest winner earns ~2.3× a minute of
median solo CHAIN**, and ~1.4× even SAT Rush (the top solo earner).

## 3. Sim (`node claude/finetune/h4-sim.mjs`) — wins/min, T0/R0, chill

Per-word rate from `wordWinsEstimate` (5-letter word) × 1.5 mean rarity/combo weight, same for all modes.

```
skill   |  CHAIN   FUSE    SAT |  WB win  lose   xCH |  BZ win  lose   xCH |  RC win  lose   xCH
novice  |    180     90    300 |     420    60   2.3 |     343    69   1.9 |     540   270   3.0 |
median  |    279    140    450 |     630    90   2.3 |     643   129   2.3 |     900   450   3.2 |
strong  |    390    195    600 |     840   120   2.2 |    1029   206   2.6 |    1126   563   2.9 |
```
A won match pays 1.9–3.2× solo CHAIN per minute at every skill. Losers keep per-word pay only.
Lopsided real wins (strong vs novice): WB ×7 uncapped; Blitz ×3.67, RACE ×1.96 (contest cap trims a
rout slightly — documented, intended).

**Farm attempts** (wins/min to the farmer's wallet):
```
WB  AFK dummy tab, SAME browser                fallback:self             129/min   0.46x CHAIN   0.15x strong-win
WB  AFK dummy, 2nd profile, 0 words            fallback:rival-words      129/min   0.46x CHAIN   0.15x strong-win
WB  minimal dummy, 2nd profile, 3 words, chill match                     504/min   1.81x CHAIN   0.60x strong-win
WB  minimal dummy, 2nd profile, 3 words, HELL  match                    1658/min   5.94x CHAIN   0.99x strong-win
WB  full self-play, 2 profiles, 20 words/min   match:cap-pace            870/min   3.12x CHAIN   1.04x strong-win
WB  2-word game                                fallback:my-words         150/min   0.54x CHAIN   0.18x strong-win
WB  bot room (vs-bot)                          fallback:bots             135/min   0.48x CHAIN   0.16x strong-win
BZ  AFK dummy, 2nd profile, 3 answers          match:cap-rival           411/min   1.47x CHAIN   0.40x strong-win
BZ  dummy answers 12 (half of mine)            match                    1029/min   3.69x CHAIN   1.00x strong-win
BZ  bot room                                   fallback:bots             206/min   0.74x CHAIN   0.20x strong-win
RC  dummy types 3 then leaves (forfeit)        match:cap-rival           775/min   2.78x CHAIN   0.69x strong-win
RC  dummy types 13, alternating tabs           match                     703/min   2.52x CHAIN   0.63x strong-win
RC  queue filled with bots                     fallback:bots             625/min   2.24x CHAIN   0.56x strong-win
RC  2-word race                                fallback:my-words         150/min   0.54x CHAIN   0.13x strong-win
```

**Verdict.** Same-browser tabs, AFK seats, bot rooms and 2-word games unlock nothing new (they get
exactly today's rule). The only route to the match bonus without a real opponent is a **second
browser profile / device actually playing** — and the contest + pace caps hold that at **≤ 1.04×
what an honest strong winner earns**, never more. (RACE vs bots already out-earns CHAIN at 2.2× —
that is RACE's existing ×3 per-word rate, unchanged by H4.) Residual risk worth a backend follow-up:
the server could refuse the bonus flag when both seats share an IP; the client cannot see IPs.

## 4. Adversarial review (self, against the shipped code)

- *Stale closures*: every input is a ref (`myIdRef`, per-game refs, the roster ref synced from the
  `[room]` effect) — nothing reads `room`/`view` from the drain closure. setView / FIFO untouched.
- *Double pay*: one `noteRoundBonus({key:'winner'})` per game; WB, Blitz (ledger opened at
  `game_started`) and RACE (ledger opened at `race_start`) all go through it.
- *Blitz 0–0 "winner"*: `myWords ≥ 5` gate → no bonus.
- *Deferred rarity scoring* (`whenRarityReady` cold path): a word scored after game_over is not in
  `gameTotal` — the bonus is slightly under, never over.
- *Clock*: an unstamped start → `minutes = null` → no pace cap (fails toward the honest player);
  a manipulated local clock can only loosen the pace cap, the contest cap still holds.
- *Receipt honesty*: the bonus row shows the real total multiplier (`1 + M × counted/myWords`) and
  the cap/fallback note; the WINS EARNED line is the same `grantWins` credit.

## 5. Popup

`WinnerPopup` (lazy chunk shared by GameScreen + WordRaceScreen, so the main bundle is flat):
a non-blocking, `pointer-events:none` layer inside the game-over overlay the screen already owns
(no new `position:fixed`). Bungee, `WINNER` at `var(--fs-panel)`+, amount counts up from 0; one
finite pop-in (transform/opacity), a hold, a fade, then unmount. Reduced motion → a static card
with the final amount, removed after the same hold. Only the winner sees it; when a gate held the
bonus to 0 (Blitz/RACE vs bots) it still says WINNER and names the reason.
