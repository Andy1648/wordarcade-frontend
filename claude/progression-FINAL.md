# TYPE A WORD — PROGRESSION FINAL (Oct 6 2026, 17:15 ET) — FROZEN

Andy Oct 6: full reset is back ON; this must be final ("no room for error"). Base = the Rebirth Rush loop he said was better than everything since ("basically that but scale up"), plus his rules: rebirth must never be what people do more than playing; games are the route to POWER and marks; rebirth spends levels (subtraction, not ×0); rebirth worth reduced; no mashing exploit; smooth bar. Only constants may change later (±20%, after the CI sim). No restructures.

## The loop (one sentence each)
1. **Type letters → XP → LEVELS.** Game letters count ×1. Menu typing counts ×0.2 and ONLY real dictionary words (space/Enter), so mashing earns 0.
2. **Play games → WINS.** Wins come only from game modes. Wins buy POWER (the only thing wins buy).
3. **POWER** = ×2.5 XP per tier (the v8 KEY feel Andy liked). Kept through rebirth, reset on ascension.
4. **REBIRTH** spends 25×(R+1) levels (R1 costs 25, R2 50, R5 125…). Leftover levels stay. ×2 XP and wins per rebirth, forever.
5. **Play games → GEMS → ROLL marks** (75 gems a roll). Marks multiply XP/wins by rarity.
6. **ASCEND** at R10 (then R15, R20…: 10 + 5×★): rebirths + POWER reset, +1 ★; each ★ adds +100% to XP and wins.

## Numbers (final constants)
| piece | rule |
|---|---|
| XP needed | need(n) = 400 × 1.06^(n−1) — one curve for everyone, never scales with R/POWER |
| XP / letter | 10 × 2.5^POWER × 2^R × (1 + ★) × MARK. Game letters ×1, menu real-word letters ×0.2, non-words 0 |
| Menu anti-mash | dictionary words only; same word within 60 s pays ×0.5, ×0.25, then 0; >12 letters/s earns 0 |
| WINS / word | 22 × length/5 × MODE × 2^R × (1 + ★) × MARK. MODE: Word Bomb/Blitz ×1 · RACE ×1.5 · CHAIN ×2 · SAT ×3 · FUSE ×1 (FRENZY ×5 for 5 min) |
| POWER | tier P→P+1 costs 300 × 8^P wins. Effect ×2.5 XP per tier. Hold-to-buy |
| REBIRTH | needs LV > 25×(R+1); spends those levels; keeps the rest. Server-checked (lb_rebirth), one per request, ≤12/hour |
| AUTO REBIRTH | toggle, unlocked at R2; still one server call per rebirth |
| ASCEND | at R = 10 + 5×★: R → 0, POWER → 0, level → 1, ★ +1 |
| GEMS | game-only: drop 1 in 15 game words for 3–12 · beat a bot +18 · multiplayer +15 per player beaten · win streak +4 · achievements 40–200. Menu typing gives no gems |
| ROLL | 75 gems. Odds COMMON 1/2 (×1.1) · RARE 1/10 (×1.25) · EPIC 1/100 (×1.5) · LEGENDARY 1/1,000 (×2) · MYTHIC 1/10,000 (×3) · SECRET 1/100,000 (×5). Pity: EPIC+ every 50 rolls, LEGENDARY+ every 500. LUCK ×1.25 at R7. Dupes → ★ pips. One MAIN mark (2nd slot at R5) |
| UNLOCKS | start: ROLL + INDEX visible · R1 AUTO ROLL · R2 AUTO REBIRTH · R5 2nd MARK slot · R7 LUCK ×1.25 · R10 ASCEND |
| BOARD | ★ desc → rebirths desc → level desc |
| Ranks | R0 KEYMASH · R1 TYPO · R2 CLACKER · R3 HOTKEY · R4 INKSTORM · R5 WORDSMITH · R6 KEYFIEND · R7 CAPSLOCK · R8 OVERCLOCK · R9 GLYPHLORD · R10 LEXIBEAST · ★1 VOIDTYPER · ★3 ASCENDANT · ★5 OMNIKEY · ★10 FINAL BOSS · ★20 ENDGAME |
| Numbers | everything through formatNum (K/M/B…), never capped |

## Sim (python, no marks; 70% games for median; CI must reproduce ±25%)
| first time to | casual | median | fast | menu-only (real words) |
|---|---|---|---|---|
| R1 | 22 min | 12 min | 6 min | 73 min |
| R3 | 86 min | 44 min | 25 min | 11.7 h |
| R5 | 3.4 h | 1.8 h | 59 min | — |
| R10 / ★1 | 19 h | 9.9 h | 5.6 h | — |
| ★2 | — | 34 h | 19 h | — |
Fast ≈ 1.8× median (no runaway). Rebirths ≈ 1 per hour of play after R3, so playing always beats rebirthing. Menu-only players progress ~6× slower than game players: games are the route. Masher earns 0. Spammer: server pace cap, gains nothing.
Rejected while tuning: ★ = R−9 per ascension + (1+★) → ★600 in 24 h (runaway); G 1.08 → R10 never reached in 40 h (wall).

## The reset (Andy runs the SQL, then "flip SEASON2")
Everything resets except usernames. Each player gets GEMS = round5(300 + 40 × old rebirths) (R0 300 = 4 rolls · R10 700 · R100 4,300 = 57 rolls → EPIC+ guaranteed by pity). Shown ONCE on the designed SEASON 2 welcome ("SORRY FOR THE MAINTENANCE · EVERYONE STARTS FRESH", OLD RUN → YOU GET, COLLECT flies gems into the wallet). Never a basic popup.

## Rules that never change
No wins for rank-ups; all claims live in ACHIEVEMENTS (gems). Every win shown. Nothing pops up in the middle. Every rebirth/ascend is a server action.
