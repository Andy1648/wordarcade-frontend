# JOB 20 — the 60-second pitch (chore/pitch, REPORT ONLY)

## What it IS

**One sentence (stranger):**
TYPE A WORD is a browser word-game arcade where every key you press earns you points — five fast modes
(bomb defusal, category races, vocab bounties, word chains) wrapped in a loud Flash-cartoon look, with
a whole leveling-and-upgrade economy layered on top so you keep chasing "one more word."

**One sentence (portal reviewer):**
A free, instant-play, mobile-and-desktop web title that fuses real-time multiplayer word games (Word
Bomb, an AI-judged Category Blitz) with solo vocab/typing modes and a full incremental economy —
levels, prestige/rebirth, a rarity-priced currency, an upgrade shop — all in one cohesive Newgrounds/FNF
aesthetic, no download, no login required to play.

**One sentence (admissions reader):**
A solo-built, production-deployed web game (React + a Node/WebSocket backend, live at typeaword.com) that
turns typing practice into a genuinely compelling arcade-plus-idle loop — demonstrating end-to-end
product design: real-time multiplayer, an AI answer-judge, a balanced game economy, accessibility work,
and a distinctive, consistent visual identity.

**One paragraph:**
TYPE A WORD makes *typing itself* the game. On the menu, every keystroke fills your level bar, so you're
earning from the first second. From there you drop into five modes: **Word Bomb** (real-time
multiplayer — type a word containing the given fragment before the bomb blows, last speller standing),
**Category Blitz** (race to name real answers in a niche category, validated by an AI judge that accepts
the creative answers a fixed list never could), **SAT Rush** (a solo vocab gauntlet themed like a
manga bounty-hunt, where the skill is recognizing a word *early* before it auto-spells itself), and
**Chain / Fuse** (solo word-linking puzzles). Wrapped around all of it is a deep, deliberately-tuned
economy: a WINS currency that pays *more for rarer words you actually know*, an upgrade shop, daily
streaks, a collection, achievements, and a prestige "rebirth" that resets your level for a permanent
multiplier. It looks like a lost Newgrounds Flash game and plays like an incremental you can't put down.

**One page:**
The core insight is that typing is a skill everyone already has and most games treat as a chore (a
name-entry field, a chat box). TYPE A WORD makes it the entire verb. The menu is not a lobby you pass
through — it's a playable idle screen where typing earns XP, so a new player is rewarded before they
ever pick a mode. That lowers the activation cost to essentially zero.

The five modes each stress a different edge of "words fast": Word Bomb is social pressure and quick
recall under a shrinking clock; Category Blitz is breadth-of-knowledge, and its **AI judge** is the
standout — it lets a niche category ("cryptids", "web browsers") accept any real answer without a
human-authored list covering every case, which is exactly where ordinary word games feel cheap and
wrong. SAT Rush is a solo vocabulary trainer disguised as a bounty-hunt poster: every word is
*eventually* typeable because letters auto-reveal, so the game isn't "can you type it" but "did you
*know* it in time" — a clean, honest vocab test. Chain and Fuse are lighter solo puzzles that round out
the offering for single-player sessions.

Underneath sits an incremental economy with real depth: WINS scale with word **rarity** (a word absent
from the common corpus pays a big multiplier), so vocabulary is directly, visibly rewarded — typing a
rare real word feels like a flex. Wins buy permanent upgrades (XP-per-letter, a rarity-payout boost, a
repeatable momentum multiplier) and cosmetics/themes; **rebirth** resets your level for a permanent
multiplier, giving the long tail a prestige loop. Daily streaks, a collection of words you've found,
achievements, and a rank ladder give returning players something to chase. The whole thing is one
consistent, hand-tuned cartoon world — flat neon, thick black outlines, hard shadows, snappy
transform-only motion, a synthesized (asset-free) sound engine — deployed live and playable instantly
on phone or desktop with no account.

## What it does that (almost) nothing else does — honestly

I won't overclaim world-firsts; the honest answer is that the **combination** is the differentiator,
and two individual pieces are genuinely uncommon:

1. **The mash-up itself is rare.** Real-time *multiplayer* word arcade + *solo* vocab/typing modes + a
   full *incremental* economy (prestige, rarity-priced currency, upgrade shop) in one cohesive package.
   Each ingredient exists somewhere — skribbl/word-bomb clones, Monkeytype, Cookie Clicker — but I'm not
   aware of another title that welds a competitive word game to an idle-game economy this completely,
   under one art direction, free and instant in the browser.
2. **Rarity-priced typing** — the harder/rarer the real word you type, the more it pays — turns
   vocabulary into the progression curve itself. Most word games score length or speed; scoring
   *rarity* (rewarding *knowing* words) is a genuinely different, and genuinely on-theme, economy.
3. **The Category Blitz AI judge** — using an LLM as the answer validator so a niche category accepts any
   real, creative answer instead of failing on a fixed list — is still uncommon in shipped word games and
   is the mode's real USP.
4. **SAT Rush's "spell-along" honesty** — every word is eventually typeable, so the skill is
   *recognizing it early*, not out-typing it. That reframes a vocab quiz into a reaction-of-knowledge
   test, which I haven't seen done this way.

**What is NOT unique:** the individual modes have clear ancestors (Word Bomb ≈ the classic bomb-party
game; Chain ≈ word-chain/shiritori; Blitz ≈ scattergories/category races), the incremental loop borrows
the standard prestige/upgrade vocabulary, and the Flash-cartoon look, while well-executed and
consistent, is a deliberate homage rather than a new style. The originality is in the *synthesis and the
economy*, not in any single mechanic — and that's the honest, and more useful, way to pitch it.
