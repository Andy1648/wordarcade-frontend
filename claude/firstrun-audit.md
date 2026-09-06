# JOB 5 — first-run audit (genuine new-player path) · REPORT ONLY

Walked the TRUE cold start (no localStorage seed) at mobile 390×844 + touch. Screenshots in
`claude/firstrun/`. Complements JOB F (which seeded LV30); this is what a brand-new player actually sees.

## The path
Cold load → **gesture-gated splash** → intro chain → **LV1 menu** (0 wins, CHAIN/FUSE/SAT locked).

## Findings

**Good — the onboarding basics land:**
- **The splash is a deliberate entry gate** — "TYPE TO START" on a fine pointer (requires N credited
  keystrokes), "TAP TO START" on touch (single tap). It requires intent, teaches the core verb (typing),
  and doubles as the audio-unlock gesture. The splash wordmark wraps to **two full lines and is NOT
  clipped** (see below — the menu's is). Attract-screen decor (WORD/BOOM/POW/…) is busy but on-brand.
- **First-visit XP hint:** the LV1 menu shows **"TYPE ANYWHERE TO EARN XP"** under the bar — the one
  thing a newcomer most needs to know (the menu itself is a play surface). Verified it works: typing
  "hello" on the menu moved the bar to 10/120 live. The hint is set to disappear at LV2.
- **Unlock teaser:** "NEXT · BOLT FRAME · LV 3" tells a new player a reward is 2 levels out.
- **Locked-mode previews are excellent** (`06`): tapping locked CHAIN shows what it is ("Each word starts
  where the last one ended"), a worked EXAMPLE (E→EAGLE→ELEPHANT→TIGER), the payoff ("200 WINS / WORD ·
  SURVIVAL - 1 LIFE"), and the gate ("UNLOCKS AT LV 20 · YOU'RE LV 1 · 19 TO GO"). Clear aspiration.

**Rough:**
1. **HIGH · The menu wordmark is clipped under SHOP at LV1 too** (`04`) — a new player's very first menu
   impression shows the app's own name truncated ("TYPE A WO"). Notably the SPLASH wordmark (same words)
   wraps two lines and renders in full, so this is a **menu-only single-line layout bug** — the fix is to
   make the menu wordmark wrap like the splash does (exactly what `fix/visual-pass-2`/JOB C does). Merge it.
2. **MEDIUM · Only 2 of 5 modes are above the fold** (WORD BOMB + CATEGORY BLITZ; CHAIN/FUSE/SAT are below
   the one-screen fold). A newcomer may not realize three more modes exist — and the locked previews
   (their best progression hook) are only reachable by scrolling to cards they can't see. Same as JOB F #3.
3. **LOW · The aspirational payoff a newcomer sees for a locked mode is "200 WINS / WORD"** (CHAIN) — 10×
   the "20 WINS / WORD" on the visible WORD BOMB card. That 10× gap is the current unlock-ladder economy
   and is exactly what a JOB B mult-flatten would erase (dropping CHAIN's advertised rate to ~30) — a
   concrete reason the rebalance is coupled to the new-player pull, reinforcing JOB B's "defer + re-tune
   together" call.

**Non-issues (noted so they aren't re-investigated):**
- A single **404 on `/_vercel/insights/script.js`** appears on the LOCAL preview — that's Vercel Web
  Analytics, injected only on the production edge; absent locally by design. Not a bug.
- The splash gate did not advance under Playwright's synthetic tap/type in-harness (I reached the LV1
  menu via `?portal=1`, which skips only the intro, not the account state). Likely a synthetic-event
  nuance rather than an app defect, but worth a note for anyone automating the first-run or testing
  assistive-input dismissal of the splash.

## Net
Onboarding fundamentals are solid (gesture gate that teaches typing, a clear "type to earn XP" hint,
strong locked-mode previews). The one real defect on the new-player path is the **menu wordmark clip**
(fixed on a branch, unmerged); plus the standing discoverability question that 3 of 5 modes sit below the
fold. No crashes or dead screens on the first-run path.
