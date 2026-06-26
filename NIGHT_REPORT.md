# NIGHT REPORT — branch scratch (DO NOT MERGE)

> ⚠️ This file is **branch-only scratch** for Andy's morning review. **Delete it before any eventual merge to main.** It lives only on `night/*` branches.

---

## Word Bomb timer + live typing
_Branch: `night/wordbomb-feel` · 2026-06-26 · Tier 2 (UI, display-only) · NOT merged, NOT on prod_

**DISPLAY ONLY.** Reads already-received state (the relayed typing text + the shared timer); the WS typing stream, message handling, game logic, and timing authority are all untouched. No Tier 1 changes.

### Diff summary
- `src/components/GameScreen.jsx` — enlarged + re-colored the bomb timer number (in `BombVisual`); new `LiveTypingText` component; swapped the per-card typing render to use it (idle state now pulses dots too). 
- `src/components/GameScreen.css` — bigger/juicier `.player-typing*` (per-letter pop, block caret, "typing" dot pulse, opponent glow), stronger reduced-motion gating; stronger + reduced-motion-gated `bomb-num-pulse`.
- **2 files changed, +162 / −35** (commit `d2fb8a4`). No other files touched (LoadingScreen.jsx, audit `.md`s, generated_content_review.js, stray gameLogic.test.js — left alone).

### 1. TIMER — bigger / clearer
- The bomb countdown number is **~50% larger** (font sizes `26/30/34` → **`40/50/60`** across the calm/warning/critical tiers) with a **hotter color ramp** (calm white → warning hot-orange `#FF6B3D` → critical yellow `#FFE94A` on a red `#FF2E2E` stroke) and a **heavier black cel-stroke** so it stays legible over the mascot belly. The critical-tier throb is stronger (scale 1.12 → 1.18).
- It **rides the existing dread system** — the same `ratio`-driven calm/warning/critical tiers that already drive the fuse burn, bomb shake, vignette and pose. I only amplified the number's size/color/pulse on those tiers; I didn't add a parallel timer or change the fuse-heat logic.
- **Zero layout/scroll risk:** the number lives inside the fixed-size bomb `<svg>` (viewBox 160×185, fixed render width), so enlarging the font changes nothing about the page's box height — the in-game no-vertical-scroll fix is untouched by construction.

### 2. LIVE TYPING — made evident (the differentiator)
- New `LiveTypingText` renders the in-progress word as **big per-letter cels** (font 11px → `clamp(15px,1.7vw,21px)`): each character is its own span keyed by `position+char`, so a freshly typed letter **mounts and plays a one-shot pop** while the letters already on screen sit still (no restrobe). Backspacing removes the last span; a new char pops in. 
- A **solid block caret** blinks at the end (reads as a real cursor, not a thin line), and a **"typing" three-dot pulse** sits beside the word — the **idle state** (active player hasn't typed yet) shows those pulsing dots too, so the card reads as "someone's about to type" with a stable reserved height (no jump when typing starts).
- Colored in the typer's **session accent**; **opponent** turns get a soft accent **glow** so "you're watching someone else type RIGHT NOW" is unmistakable. Long words wrap, don't blow out the card.
- **Readable, not chaotic:** the only motion is a 180ms per-letter pop + a slow caret blink + a gentle dot bounce — no strobe.

### Constraints honored
- **Reduced-motion:** per-letter pop, caret blink, dot bounce, and the enlarged critical timer throb are ALL `@media (prefers-reduced-motion: reduce)` gated off — letters/caret/dots still render (state fully readable), just static.
- **Mute:** no NEW sound was added — opponent keystroke sounds would be noise; the local player's own keystroke tick already fires at the input and is mute-gated. (So mute behavior is unchanged.)
- **No Tier-1 touch:** WS typing stream, message handling, game/timing logic untouched — display only.

### Verified in Chrome (preview, vs a bot)
Preview: **https://wordarcade-frontend-kw91c8bsh-beenchilling.vercel.app** (Word Bomb → CREATE ROOM → ADD BOT OPPONENT → START)
- Timer renders as a big bold number on the bomb (captured the calm-tier white `15`). ✅
- Live typing on the active card renders the dots indicator + the per-letter word + the solid block caret (captured `··· FE▮`). ✅
- Game starts/runs/ends normally; **console 0 errors**, no key-collision warnings. ✅

### What only Andy's eyes can judge
- **Live multiplayer typing feel in a real 2-device game** — watching another human's letters pop in in real time is the headline moment and can't be judged solo/from screenshots (the bot types, but it's not the same as a person). Verify on laptop+phone.
- Whether the **timer size (60 at critical)** is right or wants to come down a notch on the real monitor, and whether the **critical color** (yellow-on-red) reads hot enough vs the previous white-on-red — captured calm only; the warning/critical ramp is the existing tier logic, visible as your turn runs down.
- Whether the **opponent glow** intensity is tasteful or too loud.
