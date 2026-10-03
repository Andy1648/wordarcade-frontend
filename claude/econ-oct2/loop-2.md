# Fine-tune loop 2 — after loop 1 (#144), the remaining FAILs

Inputs: `loop-sim-fix1-console.txt` (loop 1 shipped), the sim agent's `loop-1-detail.md` + probes, and the BA1 FUSE engine sim.

## FRENZY "never reached by casual" → NOT REAL (no change)
- The loop sim models FUSE with a FRENZY rate table (frenzy-sim.txt), and its casual model almost never clears a strip. Driving the REAL FUSE engine (`claude/batch-a/ba1/fuse-sim.mjs`, 300 runs) reaches FRENZY in **44%** of runs at a 6k-word vocabulary (a weak player) and 45.7% at 15k. Casual players DO see FRENZY.
- Probed a fix anyway: the strip **carries over between runs** (`CARRY=1`). FRENZY reach goes to **88–91%** of runs at every vocabulary. FRENZY is ×5 for 5 real minutes and a run is about 2 minutes, so FUSE would sit at ×5 almost all the time. That is a runaway. **Not shipped.**

## KEY POWER wall → NEEDS ANDY (conflicts with KP2)
- From 1 h on, the next KEY tier is 15–40 min of play away (and 100+ min for the strong bot at 5 h). Criterion: ≤15.
- **Cause:** the v8 ladder Andy restored in KP2 (×2.5 XP, ×6 price per tier). Income grows ×2.5 a tier but the price grows ×6, so each tier takes about ×2.4 longer than the last. KP2's own minutes report flagged T10 (~5.7 h) and T20.
- **No single constant fixes it.** Cost step 2.75 / 3 / 3.5 and softened effect steps either just move the wall or turn it into a runaway (T130, 1e72 wins/min in 20 h). Pricing purely by current income ran to T79 within the hour.
- **The shape that works** (probed on casual: 20–29 min instead of 94–754): past T8, price KEY like LETTER FORGE (N words at your current rate, growing gently) and make the per-tier effect about ×1.2.
- **Decision for Andy:** keep v8 forever (current, with walls), or switch past T8 to word-priced KEY with a gentle effect. This changes KP2's "extended forever", so it isn't mine to make.

## Other notes from the sim (no change tonight)
- **Per-level redeem codes** (R10, `wins × level`) are invisible late: about 1e-6 minutes of play at 1 h for a fast player, because level grows far slower than the per-word rate. If codes should always feel like a gift, price them in words like achievements. That's Andy's R10 spec, so I'm flagging it, not changing it.
- **Rank-ups re-pay on every rebirth climb.** Six arrive at once early (17.5 words each). Each passes the runaway test; together they're a burst, and that's the fun part.
