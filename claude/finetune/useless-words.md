# Useless-words sweep (feat/useless-words, oct3)

Rules applied: cut what a label already says, BASE for base values, shorten, keep the all-caps arcade voice.
No numbers, multipliers or economy changed.

**41 copy changes** across 23 files (5 of them dead `sub` strings in modeDialogConfig.js that never rendered),
plus 3 e2e expectation updates.

| # | file:line | before | after | reason |
|---|---|---|---|---|
| 1 | src/components/GameScreen.jsx:98 | `too_short: 'TOO SHORT — NEED 3+ LETTERS'` | `too_short: 'TOO SHORT — 3+ LETTERS'` | NEED is implied; matches WORD RACE copy |
| 2 | src/components/GameScreen.jsx:99 | `too_short_category: 'TOO SHORT — NEED 2+ LETTERS'` | `too_short_category: 'TOO SHORT — 2+ LETTERS'` | NEED is implied |
| 3 | src/components/GameScreen.jsx:101 | `already_used: 'ALREADY USED — TRY AGAIN'` | `already_used: 'ALREADY USED'` | the input stays open; TRY AGAIN says nothing new |
| 4 | src/components/GameScreen.jsx:102 | `already_said: 'ALREADY SAID — TRY ANOTHER'` | `already_said: 'ALREADY SAID'` | same |
| 5 | src/components/GameScreen.jsx:109 | `not_in_category: "DOESN'T FIT THE CATEGORY — TRY AGAIN"` | `not_in_category: "DOESN'T FIT THE CATEGORY"` | same |
| 6 | src/components/CollectionScreen.jsx:72 | `No RARE or OBSCURE words yet. Play a mode and type something obscure — SAT RUSH is the fast track.` | `NO RARE WORDS YET. SAT RUSH IS THE FAST TRACK.` | tier names sit right above; "type something obscure" restates the empty state; all-caps voice |
| 7 | src/components/ModeDialog.jsx:28 | `'MASTERY — PLAY TO LEVEL UP'` | `'MASTERY'` | the next span already says "N WORDS TO M2" |
| 8 | src/components/MenuXp.jsx:964 | `levelDetailRef.current.textContent = 'YOUR MENU LEVELED UP';` | `levelDetailRef.current.textContent = '';` | "NEW FRAME UNLOCKED" + the tier name already say it |
| 9 | src/components/RoomScreen.jsx:225 | `SHARE THIS CODE WITH FRIENDS TO JOIN` | `SHARE THIS CODE` | the code + INVITE button sit beside it |
| 10 | src/components/RoomScreen.jsx:415 | `'NEED ${minPlayers}+ PLAYERS TO START'` | `'NEED ${minPlayers}+ PLAYERS'` | it is the START button |
| 11 | src/components/RoomScreen.jsx:423 | `WAITING FOR HOST TO START THE GAME...` | `WAITING FOR HOST...` | shorter, same meaning |
| 12 | src/components/LobbyScreen.jsx:164 | `'ANYONE CAN FIND THIS ROOM AND JOIN.'` | `'ANYONE CAN JOIN.'` | shorter |
| 13 | src/components/LobbyScreen.jsx:165 | `'CODE-ONLY. INVITE WHO YOU WANT.'` | `'CODE ONLY.'` | INVITE WHO YOU WANT restates CODE ONLY |
| 14 | src/components/PublicRoomsScreen.jsx:165 | `<div className="browser-subtitle">ENTER A CODE OR PICK A PUBLIC GAME</div>` | _(removed)_ | repeats the fields below it and the "OR PICK A PUBLIC GAME" divider |
| 15 | src/components/LeaderboardScreen.jsx:445 | `YOUR PROGRESS IS BACKED UP. ON A NEW PHONE OR AFTER SAFARI WIPES IT, ENTER THIS CODE HERE TO GET IT BACK. KEEP IT PRIVATE.` | `ON A NEW DEVICE OR AFTER A WIPE, ENTER IT HERE TO GET YOUR PROGRESS BACK. KEEP IT PRIVATE.` | title already says RECOVERY CODE; shorter |
| 16 | src/components/LeaderboardScreen.jsx:414 | `NOT ON THIS WEEK’S BOARD YET` | `NOT RANKED THIS WEEK` | matches the all-time "NOT RANKED YET"; shorter |
| 17 | src/components/StatsScreen.jsx:350 | `ACHIEVEMENTS WITH THEIR GOAL HIDDEN UNTIL YOU CROSS IT` | `GOALS HIDDEN UNTIL YOU HIT THEM` | heading already says HIDDEN ACHIEVEMENTS |
| 18 | src/components/StatsScreen.jsx:390 | `SAT RUSH · CHAIN · FUSE · MENU — active typing only` | `SAT RUSH · CHAIN · FUSE · MENU` | the mode list is the rule; mixed-case tail explained it |
| 19 | src/components/StatsScreen.jsx:407 | `SAT RUSH — THE WORDS THAT KEEP ESCAPING. STUDY THESE.` | `SAT RUSH · STUDY THESE` | heading already says WORDS YOU KEEP MISSING |
| 20 | src/components/StatsScreen.jsx:422 | `BACK UP · MOVE TO A NEW DEVICE` | `MOVE TO A NEW DEVICE` | heading already says BACKUP |
| 21 | src/components/RebirthCeremony.jsx:46 | `ONLY YOUR LEVEL RESETS. EVERYTHING IN KEPT STAYS.` | `ONLY YOUR LEVEL RESETS.` | the KEPT column sits right beside it |
| 22 | src/components/PackPicker.jsx:125 | `'NO PACKS — PICK AT LEAST ONE'` | `'PICK AT LEAST ONE PACK'` | shorter |
| 23 | src/components/PackPicker.jsx:126 | `${cats === 1 ? 'CATEGORY' : 'CATEGORIES'} LOADED'` | `${cats === 1 ? 'CATEGORY' : 'CATEGORIES'}'` | LOADED adds nothing to the count |
| 24 | src/claims/ClaimsPanel.jsx:46 | `ALL CLAIMED — PLAY TO EARN MORE` | `ALL CLAIMED` | PLAY TO EARN MORE is implied |
| 25 | src/components/ShopScreen.jsx:157 | `in a word now pays +${Math.round(FORGE_PCT * 100)}% more per level.` | `in a word pays +${Math.round(FORGE_PCT * 100)}% more per level.` | "now" is filler (LETTER FORGE sticker, not KEY POWER) |
| 26 | src/progress/achievements.js:234 | `'SHOP → LETTER FORGE: forge letters one level at a time. Every forged letter in a word pays +5% more. No cap.'` | `'SHOP → LETTER FORGE. Every forged letter in a word pays +5% more. No cap.'` | cut "forge letters one level at a time" (the name says it); same +5% |
| 27 | src/progress/stars.js:156 | `'Rebirths now pay ★ — the further past the gate, the more. Spend them in REBIRTH → STAR PERKS.'` | `'Rebirths pay ★ — more the further past the gate. Spend in REBIRTH → STAR PERKS.'` | shorter, same rule |
| 28 | src/progress/marks.js:297 | `'Earn MARKS from achievements. WEAR ONE: it is your title and pays +100% to +300% on every word, growing with its rank (up to ×5.8).'` | `'Earn MARKS from achievements. WEAR ONE as your title: +100% to +300% on every word, growing with rank (up to ×5.8).'` | shorter, numbers unchanged |
| 29 | src/race/WordRaceLobby.jsx:98 | `UNDER 2 RACERS? BOTS FILL THE GRID TO 3.` | `BOTS FILL THE GRID TO 3.` | only rendered when under 2 racers — the question restated the condition |
| 30 | src/race/WordRaceLobby.jsx:101 | `WAITING FOR THE HOST TO START…` | `WAITING FOR HOST…` | shorter; matches RoomScreen |
| 31 | src/race/WordRaceLobby.jsx:61 | `SAME WORDS FOR EVERYONE. TYPE EACH ONE IN FULL TO MOVE UP. FIRST TO {RACE_WORDS} — OR MOST WORDS AT 1:00 — WINS.` | `SAME WORDS FOR EVERYONE. FIRST TO {RACE_WORDS} — OR MOST WORDS AT 1:00 — WINS.` | "type each one in full to move up" is what typing a word does |
| 32 | src/gameData.js:136 | `'SAME WORDS FOR EVERYONE. FIRST TO 25 WORDS.'` | `'SAME WORDS FOR EVERYONE. FIRST TO 25.'` | second WORDS repeats the first |
| 33 | src/solo/ChainGame.jsx:411 | `teachRule="IT MUST START WITH THE LETTER SHOWN"` | `teachRule="START WITH THE LETTER SHOWN"` | shorter |
| 34 | src/solo/FuseGame.jsx:408 | `teachRule="THE LETTERS SHOWN MUST APPEAR SOMEWHERE IN IT"` | `teachRule="USE THE LETTERS SHOWN, ANYWHERE IN THE WORD"` | shorter, plainer |
| 35 | src/satRush/SatRushGame.jsx:326 | `SAT vocab at arcade speed. Read the clue and type the word before it spells itself.` | `Read the clue. Type the word before it spells itself.` | "SAT vocab at arcade speed" restates the SAT RUSH title above |
| 36 | src/components/ConnectingContent.jsx:25 | `GIVE IT ~30s — IT DROPS YOU IN AUTOMATICALLY.` | `~30s — YOU DROP IN AUTOMATICALLY.` | shorter |
| 37 | src/components/modeDialogConfig.js:9 | `sub: 'TURN-BASED · 1–8 PLAYERS · TYPE A WORD WITH THE LETTERS BEFORE IT BLOWS.',` | _(removed)_ | dead copy: `sub` is never rendered |
| 38 | src/components/modeDialogConfig.js:18 | `sub: 'SPEED ROUND · NAME AS MANY AS YOU CAN BEFORE TIME RUNS OUT.',` | _(removed)_ | dead copy |
| 39 | src/components/modeDialogConfig.js:27 | `sub: "SOLO · KEEP THE CHAIN ALIVE — EVERY WORD STARTS ON THE PREVIOUS WORD'S LAST LETTER.",` | _(removed)_ | dead copy |
| 40 | src/components/modeDialogConfig.js:37 | `sub: 'RACE · 2–5 RACERS · TYPE THE SAME 25 WORDS FASTEST.',` | _(removed)_ | dead copy |
| 41 | src/components/modeDialogConfig.js:44 | `sub: 'SOLO · RACE THE BURNING FUSE — EVERY WORD MUST CONTAIN THE LETTERS.',` | _(removed)_ | dead copy |

## e2e expectations updated (not run here; CI runs them)

- e2e/word-bomb-scoring.spec.js — `ALREADY USED — TRY AGAIN` → `ALREADY USED` (exact match)
- e2e/pack-picker.spec.js — `loaded()` helper + comments drop the trailing ` LOADED`
- e2e/server-waking.spec.js — connecting sub-line → `~30s — YOU DROP IN AUTOMATICALLY.`

## BASE for base values

Checked every per-word / per-letter rate outside the avoided files. The only base value printed is
StatsScreen `BASE XP / LETTER` (already labelled BASE). The mode card, mode dialog and SAT RUSH cover
print the RESOLVED rate (BASE × your multipliers), so labelling them BASE would be wrong. The remaining
base-value sites are in files owned by the v11 rework (see below).

## Not touched — owned by feat/pv11 (suggestions for that branch)

- ShopScreen KEY POWER sticker blurb: `Now N WINS / WORD in WORD BOMB.` → drop "Now"; consider `BASE N WINS / WORD` if it is the unmultiplied tier rate.
- ShopScreen rebirth progress: `N LEVELS TO GO — LV x / y` says the same thing twice → keep one (`LV x / y`).
- ShopScreen rebirth KEEP line: `wins, all purchases, lifetime stats — everything else.` → `wins, purchases, stats.`
- PayoutBreakdown head `N WORDS × BASE` — already BASE; fine.
- src/tutorials/registry.js — not reviewed (owned by pv11).

## Considered and kept

- Game-over taunts / hype words / splash taglines — flavour, not explanation.
- `WINS BUY UPGRADES IN THE SHOP` (one-time explainer) — it teaches something the label does not say.
- `TYPE OR CLICK ANYWHERE` / `IT FILLS YOUR LEVEL BAR` first-run spotlight — the sub is the lesson.
- Leaderboard verdict/error copy — already short.
- GameCard BONUS tooltip — the tooltip is where the stack is named (H6 audit M2).
