# What makes incremental progression addictive — and an honest audit of TYPE A WORD

Written for the TAW economy work (feat/econ5). Goal: name the real mechanisms behind
"just one more" progression, cite real sources and games, then audit **our** system against
each — honestly, including where it's weak — and rank what to build next by impact per unit of
work.

---

## Part 1 — The mechanisms (with sources and named games)

### 1. Variable-ratio reinforcement (the engine under everything)
B.F. Skinner's operant-conditioning work showed that rewards delivered on a **variable ratio**
(unpredictable number of actions per reward) produce the highest, most persistent response rate
and the slowest extinction — far more than a fixed reward every N actions. This is the
literal mechanism behind slot machines, loot boxes, and gacha (Genshin Impact, Hearthstone
packs). The unpredictability is the addictive part, not the reward size.

- **Named:** slot machines; *Hearthstone* card packs; *Genshin Impact* wishes.
- **Takeaway for a typing game:** a *fixed* payout per word is honest and legible but flat.
  Some **variance** in the reward (a surprise crit, a rare bonus) is what turns a chore into a
  pull.

### 2. The compulsion loop / Hooked model
Nir Eyal's *Hooked* (2014) frames habit products as **Trigger → Action → Variable Reward →
Investment**, cycling until the behavior is automatic. The **Investment** step is the quiet
powerhouse: when the user puts something *in* (progress, a streak, a customized loadout), they
value the product more (the "IKEA effect", Norton/Mochon/Ariely 2011) and have something to lose
by leaving.

- **Named:** *Duolingo* (trigger = notification, investment = streak), Instagram pull-to-refresh.
- **Takeaway:** stored, visible, personalized progress = the sunk-cost anchor. Cosmetics the
  player equipped, a rebirth count, a streak — all raise the cost of walking away.

### 3. Unlock cadence — how *often* something new appears
The single strongest retention lever in progression games is **novelty frequency**: how many
minutes/sessions between "something I've never seen before." *Cookie Clicker* and idle games
front-load unlocks (a new building/upgrade every few clicks early) then stretch the gaps as the
player is more invested. Ryan/Rigby/Przybylski's **self-determination theory** work on games
(2006) shows *competence* (visible mastery/growth) is a core driver — new unlocks are the most
legible competence signal.

- **Named:** *Cookie Clicker*, *Universal Paperclips* (a masterclass in staged reveals — the
  mechanics themselves change as you progress), *Melvor Idle*.
- **Rule of thumb:** early game should hand the player something new roughly every 1–3 minutes;
  the moment the cadence dies, churn spikes.

### 4. Visible-but-locked content (the goal gradient)
Hull's **goal-gradient effect** (1932; revived by Kivetz et al. 2006's coffee-card study —
people accelerate as they near a reward) plus the **Zeigarnik effect** (unfinished tasks stay
mentally "open") mean **showing the locked reward is more motivating than hiding it**. A greyed,
padlocked item with "UNLOCKS AT LV 20" is a promise the brain wants to close.

- **Named:** *League of Legends* champion unlocks; every skill tree with visible-but-greyed
  nodes; battle-pass tracks that show tiers you can't reach yet.
- **Takeaway:** locked ≠ hidden. Locked-and-*shown* with a concrete number is the hook.

### 5. Milestone pacing & prestige/rebirth
Numbers getting **absurdly big** is its own reward (the whole idle genre). **Prestige** loops —
reset progress for a permanent multiplier — extend a game's life almost indefinitely by making
the second climb faster and shinier. The key is that the *first few* milestones come fast, and
the multiplier makes re-climbing feel powerful, not punishing.

- **Named:** *Cookie Clicker* Heavenly Chips; *Realm Grinder* / *Antimatter Dimensions*
  ascension; *NGU Idle*.
- **Design danger:** if the reset math makes the re-climb *slower* than the first, it reads as
  punishment and players quit at the prestige wall.

### 6. Variable / surprise rewards
On top of the base loop, **intermittent surprises** (a crit, a rare drop, a "lucky" bonus) spike
dopamine precisely because they're unpredictable (Schultz's dopamine-prediction-error work,
1997: dopamine fires on *unexpected* reward, not expected). Small, frequent, low-stakes
surprises beat rare jackpots for daily retention.

- **Named:** *Slay the Spire* card rewards; *Balatro* (2024) — every hand can spike into an
  unexpected huge score; *Vampire Survivors* level-up choices.

### 7. Session hooks without accounts (streaks, dailies, local state)
You don't need logins to build habit. **Streaks** (Duolingo's flame) weaponize loss-aversion
(Kahneman/Tversky) — people protect a streak far harder than they'd chase an equivalent gain.
**Daily challenges** create a once-a-day trigger and a reason to return tomorrow. All of this can
live in `localStorage`.

- **Named:** *Wordle* (one puzzle a day = scarcity + a next-day trigger, no account);
  *Duolingo* streak; *NYT Games* daily.
- **Takeaway:** a daily-unique reason to return + a streak to protect is the cheapest, most
  ethical retention you can ship.

### 8. Flow — the difficulty channel
Csikszentmihalyi's **flow** (1990): engagement peaks when challenge tracks skill. Too easy →
boredom; too hard → anxiety. A typing game has a natural flow dial (speed/word difficulty) and a
natural mastery curve (you literally get faster). Progression should ride *alongside* skill
growth, not replace it.

---

## Part 2 — The counter-evidence (where this backfires)

### A. Over-juice / feedback inflation
"Juice" (Jonasson & Purho, *Juice it or lose it*, 2012) makes actions feel good — but juice has
**diminishing returns and can invert**. When *every* action triggers screen-shake, particles,
and a stinger, nothing reads as special, inputs feel mushy, and the noise causes fatigue
(and accessibility/photosensitivity problems). The signal that matters is **contrast**: quiet
baseline, loud milestones. TAW's own design docs already encode this instinct (the menu removed
idle loops; Word Bomb cut critical-tier VFX load).

### B. The overjustification effect (extrinsic rewards crowding out intrinsic)
Deci (1971), Lepper/Greene/Nisbett (1973, the "magic marker" study), and Deci/Koestner/Ryan's
1999 meta-analysis: paying people (or point-ifying) an activity they *already enjoy* can
**reduce** intrinsic motivation once the reward is removed or feels controlling. For TAW this is
the sharpest risk: **typing is the intrinsic joy.** If XP/wins/cosmetics become the *reason* to
type, and the numbers ever feel stingy or manipulative, the underlying pleasure erodes. Rewards
should feel like *acknowledgement of* mastery (informational), not *payment for* labor
(controlling) — the distinction Ryan/Deci draw between informational and controlling feedback.

### C. Burnout, dark patterns, and trust
Streak-shame, FOMO timers, and grind walls buy short-term DAU at the cost of long-term trust and
goodwill (well documented in the *Candy Crush* / *FarmVille* backlash, and Zagal et al.'s "dark
game design patterns", 2013). The ethical and *durable* version leans on competence and
curiosity, not anxiety.

---

## Part 3 — Honest audit of TYPE A WORD against each lever

| Lever | What TAW has | Verdict |
|---|---|---|
| **Variable-ratio reward** | Wins are **fully deterministic** (per-word × mode × difficulty, now round-10). XP per keystroke is fixed. | **WEAK.** Everything is predictable. Legible and honest, but there is *zero* surprise — no crit, no rare bonus. This is the biggest missing hook. |
| **Compulsion loop / investment** | Strong investment surface: Key Power, equipped cosmetics, rebirth count, lifetime stats, all in `localStorage`. | **GOOD.** The IKEA/sunk-cost anchors exist. |
| **Unlock cadence** | Menu XP levels tick fast early; cosmetics gate at 150/400/900/2000 wins; CHAIN LV10, FUSE LV20. Key Power milestone doublers every 10 buys. | **MEDIUM.** Decent early, but between "buy a cosmetic" and "unlock a mode" there are long dead stretches with nothing *new* — just bigger numbers. |
| **Visible-but-locked** | CHAIN/FUSE cards show greyed with "UNLOCKS AT LV n"; locked-card preview dialog (Job 1) now states rules + payout. Shop items shown dimmed with price. | **GOOD** (and just improved). This is one of TAW's strongest, most correct instincts. |
| **Milestone pacing / prestige** | Rebirth ladder R1–R20 (×1.5 → ×1e11) with growing gates; re-sim shows the re-climb stays > the 200-letter floor and scales up per tier. | **GOOD** structurally. Risk: the *very first* rebirth at LV15 needs to feel like a triumphant power-spike, not a reset tax — verify the R1 moment reads as a reward. |
| **Variable / surprise rewards** | None. | **WEAK / ABSENT.** No crits, no lucky words, no surprise drops. |
| **Session hooks (streak/daily)** | Daily Challenge exists with a streak; menu shows "DAILY #n — KEEP THE STREAK". | **MEDIUM.** The daily + streak exist but are a quiet text link; the streak isn't loud, and there's no "you'll lose it tomorrow" nudge (no account/notifications, which is fine, but the in-app urgency is soft). |
| **Flow / difficulty** | Word Bomb difficulty tiers (chill→hell); SAT Rush spell-along; per-mode pacing. | **GOOD.** The difficulty channel is real and well-tuned. |
| **Over-juice discipline** | Docs explicitly removed idle loops, capped pop budgets, gated VFX. | **GOOD.** TAW is unusually disciplined here — a genuine strength. |
| **Overjustification risk** | XP/wins are framed as acknowledgement (pops, "+N"), typing is the core act. Cosmetics are *pure flair* (Economy v3 note) — good — but they also carry XP multipliers again (v3 restored `xpMult`). | **WATCH.** Keep rewards *informational*. The moment a player feels they're typing *for wins* rather than *for fun + wins as garnish*, the intrinsic pleasure is at risk. The round-number economy (v5) helps legibility, which supports the "informational" read. |

**One-line honest summary:** TAW is excellent at the *structural* levers (visible-but-locked,
investment, prestige, juice discipline, flow) and **missing the entire surprise/variable-reward
axis**, with a **soft daily/streak** that under-uses the cheapest retention lever in games.

---

## Part 4 — What we're still missing, ranked by expected impact per unit of work

Ranked high → low on (impact ÷ effort). "Impact" = expected pull on session length / D1–D7
return; "effort" = engineering + design risk given the current codebase.

1. **Surprise crits on words — "LUCKY WORD!" (HIGH impact / LOW effort).**
   Give ~**8–12%** of accepted words a **×3–×5 wins-and-XP** spike with a distinct loud pop +
   sound, deterministically seeded off the word so it's not exploitable but still feels random.
   This adds the missing variable-ratio axis with almost no new systems — it hooks into the
   existing `awardWins`/`xpPerInput` credit path. **Numbers:** base 10 wins/word → a lucky word
   pays 30–50; target one lucky hit roughly every 8–12 words so it lands ~once a round. Keep the
   *baseline* unchanged so it reads as a bonus, never a nerf (avoids the overjustification trap).

2. **Loud, protectable streaks — beyond the daily (HIGH / LOW–MED).**
   Two cheap streaks: (a) a **daily-play streak** promoted from a text link to a real flame
   counter with a "keep your N-day streak" line and a subtle "resets in Xh" cue; (b) a
   **session word-streak / combo** that grants escalating XP the longer you go without a miss.
   Loss-aversion does the work. **Numbers:** daily streak visible ≥ LV of a menu chip; combo
   tiers at 10/25/50 already exist for pops — extend them to a *wins* multiplier (e.g.
   +10%/+25%/+50%) so the streak has stakes, not just colour.

3. **A "next unlock" pointer / progress-to-next-thing (MED–HIGH / LOW).**
   The dead stretches between unlocks are the cadence problem. Add a single always-visible
   "**NEXT: [thing] in N levels / M wins**" line near the XP bar that always points at the
   nearest locked reward (mode, cosmetic, rebirth, Key Power doubler). This manufactures a
   visible goal gradient at all times for near-zero cost. **Number:** it should never read
   "nothing next" — always surface the closest of the four tracks.

4. **First-rebirth celebration + preview (MED / LOW).**
   Make R1 a *power-fantasy* moment: before rebirthing, show "you'll earn ×1.5 forever and
   re-hit LV15 in ~X taps" using the real sim numbers; after, a big one-shot celebration (the
   `rebirthCelebration` hook already exists). Converts the scariest churn point (voluntarily
   resetting) into a hype beat.

5. **Micro-quests / rotating daily goals (MED / MED).**
   3 tiny rotating goals ("type 50 words", "clear a Word Bomb round on HARD", "play SAT Rush")
   that each pay a **round-10** wins chunk. Cheap novelty cadence + a reason to touch modes the
   player ignores. Higher effort because it needs a small quest-state store + UI.

6. **Rare cosmetic drops (LOW–MED / MED).**
   Occasionally *drop* a cosmetic free from a lucky word/streak instead of only selling them —
   a genuine surprise reward. Effort is in the drop-table + "NEW!" UI and making it feel fair.

**Deliberately NOT recommending:** timers/energy, FOMO countdowns, streak-shame push, or any
mechanic that would push TAW from *informational* rewards toward *controlling* ones. Given typing
is the intrinsic joy, those would trade long-term love for short-term DAU (Part 2B/2C).

---

## Part 5 — The 3 things I'd build next

1. **Lucky Words (surprise crits).** The single highest-leverage gap: it adds the entire
   variable-reward axis on top of the credit path you already have, for very little code, and it
   makes *every word* carry a little suspense. Baseline stays flat so it's a pure upside.

2. **A loud, protectable streak (daily flame + session combo→wins multiplier).** The cheapest
   proven retention lever in games, and TAW currently under-uses it. Loss-aversion converts a
   quiet text link into a daily return reason.

3. **The always-on "NEXT UNLOCK in N" pointer.** Fixes the real cadence weakness — the dead
   stretches between unlocks — by keeping a visible goal-gradient in front of the player at all
   times, pointing at the nearest of {mode, cosmetic, rebirth, Key Power doubler}.

All three lean on **competence + curiosity + honest surprise** rather than anxiety — which is
both the more durable design and the right fit for a game whose core pleasure is simply typing.

---

### Sources referenced
Skinner (operant conditioning / variable-ratio schedules) · Eyal, *Hooked* (2014) ·
Norton/Mochon/Ariely, "The IKEA effect" (2011) · Ryan/Rigby/Przybylski, self-determination
theory in games (2006) · Deci (1971), Lepper/Greene/Nisbett (1973), Deci/Koestner/Ryan
meta-analysis (1999) — overjustification · Hull goal gradient (1932), Kivetz et al. (2006) ·
Zeigarnik (1927) · Schultz, dopamine prediction error (1997) · Kahneman/Tversky, loss aversion ·
Csikszentmihalyi, *Flow* (1990) · Jonasson & Purho, *Juice it or lose it* (2012) · Zagal et al.,
"Dark patterns in game design" (2013). Games: Cookie Clicker, Universal Paperclips, Melvor Idle,
Antimatter Dimensions, Duolingo, Wordle, Hearthstone, Genshin Impact, Balatro, Slay the Spire,
Vampire Survivors, League of Legends, Candy Crush.
