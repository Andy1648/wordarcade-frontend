## SAT RUSH: top 3 unfun moments

**Sim:** `claude/batch-a/ba1/satrush-sim.mjs`. It drives the real `engine.js`, `config.js` `stageMs`, `input.js`, `briefing.js` `pickBriefing`, `lexicon.js` and `suspects.js` from origin/main (a259259). A 50 ms clock copies the hook's timers in `useSatRushGame.js` (L343-445 stage/spell-along/lineup window, L465-517 keys, L31-46 pauses). The recent-words ring (cap 250) and the lexicon persist between runs.

**Runs:** 50 seeded runs per mode (briefing and lineup), in two variants:
- 50 fresh players, one run each.
- One player playing 50 consecutive runs, so repeats across runs are real.

**Raw output:** `satrush-sim.txt` (shipped) and `satrush-sim-v1..v5-*.txt` (fix variants), each with a `.json`.

**Median player model:**
- **Vocabulary:** P(know) = 1/(1+(rank/18000)^2.5) on `words.recall.txt`. That gives 0.96 at rank 5k, 0.61 at 15k and 0.22 at 30k.
  - Words missing from the list get a per-tier floor: .40/.30/.18/.10/.04.
  - Mean P(know) by tier is .57/.43/.31/.18/.05.
  - 96% of tier-5 words come out as "unknowable" (P < 0.1).
- **Knowledge levels:** of the known words, 60% are "cold" (recalled from the sentence) and the rest need the definition. Of the unknown words, 35% are "partial" (recognized after 1-3 more letters) and the rest "none" (waits for the spell-along).
- **Speed and errors:** reads at 200 wpm, recalls in about 1.1 s, types at 35 wpm with 4% typos.
- **Guessing:** while letters drip in, the player makes occasional guesses. When a word is studied or comes back as a revenant, its recall gets a boost.
- **Lineup final stage:** the player picks one of the two remaining suspects. If the first letter bounces, they type the other one.
- **Run cap:** runs stop at 150 words or 30 minutes. Hitting the cap means the run never ended on its own.

### 1. The per-card stage beat never runs, so you can't earn x5 even on words you know

**Evidence (shipped):**
- **Briefing:** words the player knew cold from the sentence were cleared at x5 **0.0%** of the time, in both fresh and 50-run play.
  - 99.7% of all clears are x1; 98.6% were carried by the spell-along (2 or more letters revealed).
  - SILVER TONGUE was reached in **0/50** fresh runs and 10/50 in the 50-run sequence (median at word 120).
  - "Dead stretches" (5 or more words in a row with no x5/x3): 66 across 50 runs. The longest was 132 words, i.e. the whole run.
- **Cause:** every card plays at a flat 2800 ms beat. Stage 2 opens at 5.6 s, but a median reader needs about 7-8 s just to read a ~120-character sentence.
- **With the fix (v1/v2):**
  - Briefing cold words reach x5 25.8% of the time (fresh). The x3 share rises from 0.3% to 19% (fresh) and from 1.1% to 56% (50-run).
  - Silver is reached in 50/50 runs instead of 0/50.
  - My x5 rate stays below the 74.6% in `anteFairness.test.js` because my model adds recall latency and reading noise; the test does not.

**Root cause:**
- `useSatRushGame.js:360` calls `stageMsForCard(c)`, where `c = eng.getState().current` (L348) is the engine's *presentation* object.
- `engine.js:282-306` `buildPresentation` copies word, pos, tier, gloss, context, root and alts, but **not `costMs`**.
- So `config.js:79-82` `stageMs()` always takes the no-costMs fallback and returns `DEFAULT_STAGE_MS` (2800).
- The fix/sat-ante-fairness work is dead in production. Its tests pass because `anteFairness.test.js` calls `stageMs(row)` on the raw `words.json` rows.

**Fix:** one line. Either:
- `stageMsForCard(c.row)` at `useSatRushGame.js:360`, or
- add `costMs: row.costMs,` in `buildPresentation` (`engine.js:~290`).

**Required companion change:** keep lineup on the flat base. If you don't, lineup's ×3 scale (`engine.js:42`) multiplies the per-card beat: lineup stages become 18.8-27 s (p50 24.4 s), "none" words sit idle for 45 s (p50), and 75% of run time is idle (v1). Gate it like this:

```js
const base = tuned !== SAT_RUSH_STAGE_MS ? tuned : (modeRef.current === 'lineup' ? SAT_RUSH_STAGE_MS : stageMsForCard(c.row));
```

**Trade-off:** in briefing, unknown words now wait about 2 × 8 s before letters start (idle on "none" words goes from 8.6 s to 19.8 s p50). The spell-along cadence is unchanged.

**Re-measure:** `FIX_COST=1 LINEUP_BASE=flat node claude/batch-a/ba1/satrush-sim.mjs`. Check "'cold' ... cleared at x5", "ante at clear" and "SILVER".

### 2. In lineup, the last-call buzzer kills you while you're typing the right answer

**Evidence (shipped):**
- 8.0-8.7% of lineup words are misses, and they are 100% "walked-away".
- In **148/150 and 150/150** of those misses, the player had already picked the suspect and was typing when the window closed.
- Miss rate by word length: **3.1% at 3-7 letters, 11.8% at 8-10, 28.9% at 11+**.
- Lineup runs end only through these misses: all 50/50 runs die this way, with the first miss at word 15 (p50).
- So the lives in lineup measure typing speed against the buzzer, not vocabulary. Only 4.7-6% of misses were on words the player actually knew.

**Root cause:**
- `engine.js:127` `lineupWindowMs = round(2800*1.4) + len*200`, giving 5.1/5.7/6.3 s for 6/9/12-letter words.
- 200 ms per letter is 60 wpm. The cost model's median is 35 wpm, about 343 ms per letter.
- After a 1.6 s notice-and-pick, a 12-letter word needs about 5.7 s plus any typo recovery.

**Fix:** data/constant change, `len * 200` → `len * 350`.

**Result (v2):**
- 11+ letter miss rate drops from 28.9% to 2.7%; 8-10 letters from 11.8% to 1.4%; overall misses from 8.7% to 1.4%.

**Caveat:** this removes the only real way to lose lives in lineup. Runs then hit the 30-minute cap in 45/50 cases. Pair it with a knowledge-based stake.
- I measured one: "typing the wrong suspect at the 2-suspect stage is a miss" (`COINFLIP_MISS=1`, v5). It is too harsh: runs last 15 words (p50) and the first miss comes at word 4.
- A softer stake (for example, a wrong first letter at stage 2 costs the heat plus a fixed score penalty, not a life) needs a design decision.

**Re-measure:** `LW_PER_LETTER=350 node claude/batch-a/ba1/satrush-sim.mjs`. Check "lineup miss rate by length" and "ALREADY TYPING".

### 3. Briefing has no fail state, so runs drift into an endless treadmill of words nobody knows

**Evidence (shipped):**
- Briefing misses are 0.1-0.3% of words. **50/50 runs hit the 150-word / 30-minute cap** and never end.
- Players lose 0.04-0.18 of their 3 lives in the first 60 words.
- From word 48 on, every slot asks for tier 5. As a result:
  - **63.6% of all words shown in a fresh briefing session are median-unknowable** (67.6% in the 50-run sequence).
  - Tier 5 makes up 66% of words served and is 96% unknowable.
- Deep cuts (every 15th word) are 95-97% unknowable and cleared at x5 0.0% of the time.
- Each unknown word is about 12 s of watching letters drip in (8.6 s idle at p50). Overall, 41% of briefing run time is idle.
- Score just grows with time: p50 8.5k after 30 minutes, with a p10-p90 spread of only 8.3k-8.6k.

**Root cause:**
- `engine.js:417-418` sets `autoRevealMax = length-1` and `finalHoldMs = 2*tick`. To "miss" a word you have to fail to type **one** letter in 2.2 s, after the game has shown you all the others. Even three wrong guesses only trigger a spam reveal that completes the word.
- `engine.js:56` `tierEvery: 12` with `tierMax 5` (curve at `engine.js:94-97`) pins every non-deep-cut slot at tier 5 from word 48. The tier-5 pool is only 113 words, and the median can't know almost any of them.

**Fix (constants plus one expression):**
- (a) `engine.js:417`: `cw.length - 1` → `cw.length - 2`. The last letter is still never auto-revealed, but the player must supply the last two.
  - Note: CLAUDE.md describes the spell-along as "up to length−1", so that description needs updating too.
- (b) `engine.js:56`: `tierEvery: 12` → `20`.

**Result:**
- **(a) alone (v3, with the #1 fix):** briefing runs now end, 42/50 dying at p50 51 words / about 17 minutes. Misses are 5.2% of words, and **0%** of them were on words the player knew, so a lost life now means "I didn't know it", not "I typed slowly".
- **(a)+(b) (v4):** 47/50 runs end. The tier-5 share drops from 66% to 8.4%, and the unknowable share of words shown drops from 63.6% to 7.8%. Silver is reached in 94% of runs.

**Re-measure:** `FIX_COST=1 LINEUP_BASE=flat AUTO_LEFT=2 OVR='{"tierEvery":20}' node claude/batch-a/ba1/satrush-sim.mjs`.
- Read only the BRIEFING blocks. The v4 file also applied `lineupStageScale: 2`, which was a rejected lineup probe: it dropped lineup cold-word x5 from 26.5% to 0.2%, so keep the scale at 3.0.
- Check "run end cause", "tier 5: served" and "unknowable".

### Runners-up (measured, lower frequency × badness)
- **Lineup idle time:** 49-50% of lineup run time is spent waiting. Unknown words wait 13.8 s (p50) through two 8.4 s stages (2800 × 3). Lowering `lineupStageScale` to 2 cuts the idle but kills x5 (26.5% → 0.2% for cold words), so 3.0 stays. The cost is the waiting.
- **Lineup silver is basically free:** 98-100% of runs hit SILVER by word 5. 40-46% of clears made at silver were 2-suspect coin flips, because `heatMaxRevealed` (`engine.js:446`) counts revealed letters and lineup never reveals any. Requiring stage < 2 for the heat bump wouldn't change reachability (still 50/50 runs, post-hoc check), so this is cosmetic.
- **Honest guessing gets punished as spam (briefing, shipped):** 11.5% of fresh-player words had letter-guessing during the spell-along hit the third wrong key. That zeroes heat and pays less. This depends on my guessing assumptions; real data could confirm it via `word_resolved.revealed` and the spam-reveal analytics.
- **Repeats:** no word repeats from the previous run in lineup (0%), so the recent-words ring works there. In 50 consecutive lineup runs, the first 10 words of a run average 7.8 already seen in some earlier run but 0.0 from the last 3 runs. That's pool size (129 tier-1 words), not a bug.
  - Briefing's 62.8% "seen last run" figure is an artifact of 150-word sessions overflowing the 250-word ring. Within a run, a third appearance of the same word happened 0-4 times per 50 runs.
- **Early deaths:** no run in either mode died in under 30 s or within 5 words. "Decided in the first seconds" is not a SAT RUSH problem.
