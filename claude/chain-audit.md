# JOB 8 — DOES THE CHAIN HOLD? (chore/chain-audit, report only)

Question: after Jobs 1–7, does every system feed another, or are some still lateral (you earn a thing
that makes nothing else better)? Audited against the code on this branch (unified-xp → mastery →
collection → wins-sinks → return-bonus → achievements).

## Per-system: what feeds IN → what feeds OUT

| System | Feeds INTO it | Feeds OUT to |
|--------|---------------|--------------|
| **XP** | every accepted word (Job 1), every menu keystroke, mode XP mult, rarity/combo/lucky weight, mastery XP bonus, streak, rebirth | **Levels** (only consumer) |
| **Levels** | XP | **Rebirth** gate, **mode unlocks** (CHAIN LV20/FUSE LV25), **theme** free-unlock gates, **achievements** (LV15/50), menu rank title |
| **Rebirth** | reaching the level gate | **XP mult** (all XP), **wins mult** (all wins), **collection milestone** payout, **return bonus**, **achievement** payout — rebirth multiplies almost everything. The spine. |
| **Wins** (currency) | per-word banking (rarity×combo×lucky×mode×difficulty×rebirth×WORD SENSE), collection milestones, return bonus, achievements, level-ups (no longer) | **KEY POWER**, **WORD SENSE**, **themes** (the three sinks) |
| **KEY POWER** | wins | **XP per letter** → faster levels. Loops back into XP. |
| **WORD SENSE** (Job 4) | wins | **wins mult on rare words** → more wins. Loops back into wins; rewards rarity/collection knowledge. |
| **Themes** | wins + level unlocks | menu recolor (cosmetic) + a small equipped **XP mult** (pop/sound cosmetics) |
| **Rarity** | the word you typed (recall-rank) | **wins weight**, **XP weight** (Job 1), **collection tier**, **WORD SENSE** target, rarity pop FX |
| **Collection** (Job 3) | every distinct accepted word + its rarity | **milestone wins**, **achievements** (distinct/OBSCURE counts), a display of vocabulary |
| **Mastery** (Job 2) | words accepted per mode | **per-mode XP bonus** → faster levels in that mode; **achievements** (mastery feats) |
| **Combo** | consecutive accepts in a run | **per-word weight** → both wins AND XP (Job 1) |
| **Lucky** | 1/40 accepted words | **per-word weight** (×5) → both wins AND XP |
| **Streak** (daily) | playing on consecutive days | **XP mult** (xpPerInput + xpPerWord), **achievements** (streak feats) |
| **Achievements** (Job 7) | nearly every other system's state (words, wpm, distinct, obscure, level, rebirth, mastery, streak, keyTier, wsTier) | **wins** (× rebirth) |

## The verdict: the chain now HOLDS. Before/after.

**Before Jobs 1–7** the two loops were disjoint (the whole reason for this run): XP came only from
menu keystrokes, wins only from games. Playing didn't level you; menu typing didn't buy anything.
Rarity only multiplied wins and evaporated. There was nothing between "earn wins" and "buy KEY POWER /
themes," so a maxed player plateaued.

**After**, every earning action now compounds into at least two others:
- A word you accept → XP (→ levels → rebirth/unlocks) **and** wins (→ sinks) **and** mastery (→ more
  XP) **and** collection (→ milestone wins + achievements) **and**, if rare, a bigger WORD SENSE
  payout. That is a genuinely braided economy.
- Rebirth is the spine: it multiplies XP, wins, collection milestones, the return bonus, and
  achievement payouts.
- WORD SENSE closes the rarity loop that used to dead-end: knowing rare words now permanently pays
  more, and you invest wins to make it pay even more.

## Remaining dead ends / weak edges (blunt)

1. **Themes are a near dead end.** They cost wins and grant a recolor + a tiny XP mult via the pop/
   sound cosmetics — but the recolor feeds nothing and the XP mult is small and easy to miss. Themes
   are the weakest node: almost pure sink with almost no OUT edge. *Recommend:* either lean into the
   cosmetic-only framing (fine, but then it's not a progression node) or give each theme a small,
   legible, mode-agnostic perk so buying one advances something.

2. **WPM feeds nothing.** Best/Avg WPM is measured (recent fix/three-again) and shown, and the SPEED
   achievements now consume it (a new edge from Job 7) — so it's no longer a total dead end, but it
   still doesn't feed XP or wins. *Recommend:* leave it as a skill-badge axis (achievements are enough)
   OR add a small XP bonus above a WPM threshold. Low priority.

3. **`lifetimeLetters` (raw keystrokes) is a true dead end.** Counted, shown in Stats, feeds nothing
   (Job 1 explicitly passes rawKeys 0 for words, so it's menu-keystrokes only). *Recommend:* either
   wire a volume achievement to it or drop it from the UI. Cosmetic-only stat today.

4. **Taps** (tap-to-earn count) — same as lifetimeLetters: counted, shown, feeds nothing. Minor.

5. **The daily streak's only economic edge is the XP mult + 3 achievements.** It doesn't touch wins.
   That's probably fine (it's a retention lever), but note it is a thin node.

6. **Return bonus (Job 6) is intentionally a leaf** — it feeds wins IN but nothing feeds it except the
   clock. That's by design (a retention nudge), not a flaw.

## Recommended next connections (highest compounding first)
1. **Give themes a real OUT edge** (a small per-theme perk) — the biggest lateral node that a player
   spends real wins on. #1 fix.
2. **Wire `lifetimeLetters` or `taps` into an achievement or a tiny perk**, or cut them from the UI —
   stop showing numbers that do nothing.
3. **Consider a WPM→XP micro-bonus** if speed should matter mechanically, else leave it to achievements.

## One-line answer
The chain now holds where it matters — XP, wins, rarity, collection, mastery, combo, lucky, streak,
rebirth, KEY POWER, WORD SENSE, and achievements all compound. The remaining lateral weight is
**themes** (a sink with no output), and two vanity counters (**lifetimeLetters**, **taps**). Cut or
connect those three and nothing you earn is inert.
