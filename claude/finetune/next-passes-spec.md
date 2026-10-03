# NEXT PASSES: BIG-MONITOR + IN-GAME FEEL (spec, 2026-10-03)

THROUGHPUT RULE 4 asks for this: the next items, specced with numbers and 3 versions, so each can start as
soon as #154 → #155 → #156 merge. This was written read-only, with no Playwright, tests or sims run. Every
"current" number below comes from source at feat/audit-leftovers (path:line). "Target" numbers are
proposals. Card widths at 2560 are ESTIMATED from the Homepage.jsx fit-math and must be measured
before anyone tunes against them.

Judged against Andy 11:25: ONE big thing per screen, bigger type, no useless words, a growing
satisfying feel, and animations only where they don't stack. Hard rules (CLAUDE.md): transform/opacity
only, ZERO new infinite animations, pooled nodes, no layout reads per keystroke or spawn, will-change
only transform/opacity and only while animating, nothing under 13px, no CSS zoom on game roots, and the
MENU MOTION LAW (no idle loops on the menu).

---------------------------------------------------------------------------------------------------
## PASS 1: BIG-MONITOR PASS (Andy plays at 2560x1440)

### 1.1 What is already done (do not redo)
- `src/theme/type.css` BIG tier (≥1800x1000): tokens ~1.2x on `.shop-overlay .stats-overlay
  .mode-dialog-overlay .lp-overlay .solo-root .wr-root`, plus panel widths (shop 1120, stats 580,
  dialog 760, lp 560, death card 540, race 1220).
- HUGE tier (≥2200x1250): `.solo-root/.wr-root` (--solo-k 1.45), `.game-wrap` (--wb-k 1.45, which also
  covers the WB/Blitz game-over card at `calc(1160px * --wb-k)`, GameScreen.css HUGE block), and
  `.menu-xp-cluster`.
- Leaderboard: has its own continuous dial `--lb-u: max(1px, min(0.07vw, 0.11vh))` (1.58 at 2560),
  LeaderboardScreen.css:491. No change needed.
- Room / Lobby / Public rooms: `useFitZoom` grows the form box up to MAX 1.9 (hooks/useFitZoom.js).
  These are form screens, not game roots, so zoom is allowed there. Verify only.

### 1.2 What is still small at 2560x1440 (and at 1920x1080)
"k" = the screen's multiplier. Today's value at 2560 is shown; a dash means no tier exists.

| Screen (file:line) | Fixed box today | 1920 today | 2560 today | Target 1920 / 2560 | Type today at 2560 |
|---|---|---|---|---|---|
| SAT RUSH poster `.sr-stage` (SatRush.css:94) | min(920px,94vw) | 920 | 920 (36% of width) | 1100 / 1330 | base tokens (body 18, label 13) |
| SAT cover / results `.sr-cover` 750, `.sr-respage` 1137 | 560 | 560 | 560 | 670 / 810 | base |
| SAT briefing `.sr-brief-page` (1551) | 620 | 620 | 620 | 740 / 900 | base |
| SAT mode select `.sr-modeselect` (1856) | 520 | 520 | 520 | 620 / 750 | base |
| SAT mugshot slots `--slot-max` (623) | 48px slot, glyph 24px | 48 | 48 | 58 / 70 (glyph 29 / 35) | n/a (slot-fit) |
| SAT decorative disc (2138) | 340px | 340 | 340 | 410 / 490 | n/a |
| STATS `.stats-panel` (type.css BIG) | 460 → 580 | 580 | 580 (23%) | 580 / 680 | body 21, label 16 |
| SHOP `.shop-panel` | 900 → 1120 | 1120 | 1120 (44%) | 1120 / 1560 | body 21, label 16 |
| Mode dialog `.mode-dialog-shell` (ModeDialog.css:45/76) | 600/660 → 760 | 760 | 760 (30%) | 760 / 1060; max-height min(94vh,760) → min(94vh,1060) | body 21 |
| Locked preview `.lp-panel` | 560 | 560 | 560 | 560 / 780 | body 21 |
| MARKS `.mx-panel` (MarksIndex.css:14) | 980, in NO tier | 980 | 980 | 1180 / 1420 | base 18/13 |
| REWARDS `.claims-panel` (ClaimsPanel.css:15) | 560, no tier | 560 | 560 | 680 / 810 | base |
| Rank ladder `.rank-panel` (RankLadder.css:21) | 420, no tier | 420 | 420 | 500 / 610 | base |
| Rebirth ceremony `.rbc-card` (RebirthCeremony.css:15) | 640, no tier | 640 | 640 | 770 / 930 | base |
| WINNER popup `.winner-pop` (WinnerPopup.css:17) | 460 | 460 | 460 | 550 / 670 | base |
| Wins credit toast `.wct` (WinsCreditToast.css:15) | 320 | 320 | 320 | 380 / 460 | base |
| Payout breakdown (PayoutBreakdown.css:7) | 420 | 420 | 420 | × host k (solo/wb) | host |
| K.O. burst `.ko-burst` (GameScreen.css:4436) | 280 | 280 | 280 | 280 / 406 (× --wb-k) | — |
| Menu cards: name (GameCard.css:427) | clamp(22, 22cqw, **40px**) | cap binds (~77 wanted) | cap binds (~100 wanted) | 48 / 58 | — |
| Menu cards: tag 375 / pay 476,493 / label 450,627 / foot 644 | caps 17 / 20,22 / 14 / 16 | caps bind | caps bind | ×1.2 / ×1.45 of the cap (tag 24, pay 29/32, label 19 (2560), foot 23) | — |

Menu cards at 2560: five across in `min(96vw, 2400px)` → ESTIMATED ~465px wide per card. The cqw
middle terms already scale. Only the px CAPS hold the text at its 1366 size. Leave untouched: the
wordmark (locked), the corner nav chips (44px; they stay smaller so the GOLD trophy, 164px at 2560,
remains the one big thing), and every screen already listed in 1.1.

### 1.3 Mechanism (the same for all versions)
- Never CSS zoom on a game root. game-fill and overlay-fill fail on any ancestor zoom ≠ 1.
- Font sizes keep going through `--fs-*` tokens, which typeScale.test enforces at build time. A token
  override sits in a media block in type.css. A cap inside a declaration that already contains `cqw`
  (the cards) or `--slot-size` (SAT) is allowed to be `calc(Npx * var(--k, 1))`, because the
  FIT_TO_SLOT exception covers it.
- Every fixed px box that has to grow with the type gets multiplied by the same k. A tokens-only bump
  wrapped THEIR TURN out of its box before (type.css comment).

### 1.4 Three versions
**V1: ONE HUGE TIER EVERYWHERE.** Append every root above (`.sr-app .mx-overlay .claims-overlay
.rank-overlay .rbc-layer .winner-pop-layer .wct` + the BIG-tier overlays) to the existing
≥2200x1250 block. Use the game-wrap token set (h1 92 / h2 60 / panel 40 / body 26 / label 19 /
micro 16) and one shared `--ui-k: 1.45` that each panel multiplies.
+ One breakpoint, ~60 lines, the same look in every overlay.
− A 1.0→1.45 cliff at 2200px. A 2560x1080 ultrawide and a 1440p window at 125% scaling (2048x1152)
  get nothing. SAT's retro page and the shop need different ratios: shop at 1.45 is 1624px and
  crowds its 4-col grid.

**V2: PER-SCREEN k (the shipped pattern: --solo-k, --wb-k, --lb-u).** Add `--ov-k` (overlays:
1.2 BIG / 1.4 HUGE), `--sr-k` (SAT: 1.2 / 1.45), `--card-k` (menu cards: 1.2 / 1.45) and
`--pop-k` (popups and toasts: 1.2 / 1.45). They hang off the two breakpoints that already exist.
SAT joins the BIG token tier only now that its widths scale with --sr-k: the D1 review had excluded it
because "PICK YOUR BEAT" clipped when the type grew while the columns did not.
+ Each screen is tuned on its own and the work reuses a reviewed pattern. Nothing changes below
  1800x1000, so the 1280x551, 1366x625 and 390x844 diffs are zero. Each k can ship in its own commit.
− Four more custom properties. Two steps rather than continuous growth.

**V3: CONTAINER QUERIES.** Make each overlay root `container-type: inline-size` and size its type and
boxes in `cqi`.
+ Continuous. It also handles a 2560x1080 ultrawide and a 1440p window at 125%.
− Layout containment turns the root into the containing block for `position:fixed` descendants,
  which breaks the popups, ClaimPopup, the moments queue and the toasts mounted inside overlays.
  typeScale.test would need its cqw exception widened from "fit-to-slot" to "everything", which
  defeats the gate. The `--fs-*` tokens must stay px or clamp(px…px), so the scale fragments into
  ad-hoc cqi values.

**RECOMMEND V2.** It is the pattern three screens already ship (solo, WB, leaderboard), every number
in 1.2 maps to one k, and the zero-diff-below-1800 property keeps the small-screen gates honest. If
Andy wants continuous growth later, use the --lb-u length-dial form (N * --x-u, a px length), not
container queries.

### 1.5 Files that would change (V2)
`src/theme/type.css` (token blocks + k values) · `src/satRush/SatRush.css` (the 6 boxes, --slot-max,
the 340 disc) · `src/components/GameCard.css` (5 caps × --card-k) · `MarksIndex.css`,
`claims/ClaimsPanel.css`, `RankLadder.css`, `RebirthCeremony.css`, `WinnerPopup.css`,
`WinsCreditToast.css`, `ModeDialog.css` (max-height) · `GameScreen.css` (.ko-burst × --wb-k) ·
`PayoutBreakdown.css` (inherit host k). All of it is CSS, so Tier 3. The card caps live inside the menu's
fit-math, so treat them as Tier 2 and play them.

### 1.6 Risks
- SAT is the riskiest. Its poster has its own height fit (`sat-briefing-fit`). At 1440 tall a
  1330px poster with 70px slots is fine, but at 1920x1080 the 1100 poster plus BIG type can pass
  1080. Check the briefing and the 6-suspect lineup at both.
- Shop grid: at 1560 the auto-fill columns may jump from 3 to 4, which moves the receipt and the codes
  field. shop-fit covers it.
- Card caps: the fit-to-slot pay-line formula (`--line-room / --pay-em`) already bounds them, but
  "590K WINS / WORD (x12)" at 32px must still fit on one line. card-fit catches it.
- min-text runs at 1920 but NOT at 2560. Add 2560, or the HUGE-tier floors stay unverified.

### 1.7 Gates that catch regressions
`e2e/viewport-integrity` (7 viewports incl. 2560 + 1920: overflow and clipping on every screen,
dialog and game-over) · `overlay-fill` (2560 incl.; no zoom ≠ 1) · `game-fill` (no ancestor zoom) ·
`min-text` (**add 2560x1440**) · `menu-fit` / `card-fit` / `menu-fill` · `shop-fit` ·
`sat-briefing-fit` / `sat-rush` · `dialog-quality` / `mode-dialog` · `marks` · unit
`src/perf/typeScale.test.js` (descending order, floors, no raw px font-size). Before and after shots at 1280x551,
1366x625, 390x844, 1920x1080 and 2560x1440. The diff must be zero at the first three.

---------------------------------------------------------------------------------------------------
## PASS 2: IN-GAME FEEL PASS (H2c / H3: hero type, clear per-word feedback, FRENZY/BOOST/clutch, growing feel)

### 2.1 What happens today (source-read)
| Event | WB | Blitz | CHAIN / FUSE | SAT RUSH |
|---|---|---|---|---|
| Accept | `fireAccept` (GameScreen.jsx:1511): burst **24 + 6×combo** particles (unbounded: 84 at c10, 144 at c20; pool cap 300), ring 120 + 10×combo px, `squash`+`flash` on the INPUT, **full-screen white flash 0.18 on EVERY word**, .game-shake 200ms, HypePopup word at **--fs-panel (28px)** 700ms, `validCue` pitch 480+45×combo | 10-particle spark + `flash` on the prompt, hype word | travel FX (CHAIN), strip fill (FUSE), `sndWordAccepted(combo)`. Input never animated (SoloShell law) | stamps / CAPTURED, mult tick (retro-print, duotone, quiet by design) |
| Reject | input shake 400ms + red screen flash 0.12, buzz | input shake | reject sill opacity pulse + reason line | ink treatment |
| Combo step | ComboMeter badge re-keys `combo-pop` 240ms; tiers 2/4/7/10. **fire/max run `combo-spark` 720ms INFINITE + `combo-shake` 200ms INFINITE** (ComboMeter.css:86,107) | same | LiveStack COMBO row number changes, **no pop** | heat / SILVER TONGUE |
| Combo break | `combo-shatter` "N HITS LOST" 600ms | same | silent | heat zeroed |
| Rare word | **only a label-size tag in the kill feed** (GameScreen.jsx:1139) | same | `RarityFlash` --fs-hero, fixed top 30%, 750ms | RarityFlash |
| Lucky (1/40, ×5) | **SILENT**: pays ×5 in App.jsx, nothing on screen | **SILENT** | gold ring + "LUCKY ×5" 400ms (SoloShell:384) | AnteMeter |
| Clutch | ClutchCallout "<1s CLUTCH!" / "<2s CLOSE!" + ClutchPopup centre | — | FUSE: ClutchBurst 6 letters, 1.3s (suppressed while FrenzyBurst plays) | — |
| FRENZY start / end | — | — | FUSE FrenzyBurst 26 tiles 1.8s / global `<TimerOver/>` (App.jsx:2821) 1.2s | — |
| BOOST start / end | BoostPill slam-in in LiveStack; last 10s = 10×1s pulse; TimerOver 1.2s | same | same | — |
| Level-up mid-game | **nothing**: XP banks per word silently; the level-up only celebrates in the menu's useXpCapture; a mastery milestone grants wins without a moment | same | same | same |
| Game over | stamp beat + confetti 26, KO hero, WinnerPopup count-up (H4) | same | death card (mascot, total, SCORE/BEST) | CASE CLOSED count-up |

### 2.2 Problems found
1. **Missing feedback.** Lucky in WB/Blitz is silent, which breaks H5 ("never a silent number change").
   The rare word in WB/Blitz is a 13–16px feed tag. A mid-game level-up shows nothing anywhere. The
   solo combo step and combo break are silent.
2. **Too small.** The per-word hype word sits at 28px (--fs-panel) in WB/Blitz while the solo RarityFlash
   is hero-sized. That is backwards for "hero type".
3. **Stacking.** In FUSE one accept can fire RarityFlash, the LUCKY ring, ClutchBurst or FrenzyBurst,
   and a global TimerOver all in the same frame. Only clutch-vs-frenzy is arbitrated. `lib/moments.js`
   (H5 queue) is not wired in-game.
4. **Not growing.** Today the feel scales only through particle count and ring radius. Neither has a
   cap, so it gets noisier instead of better, and the white full-screen flash is identical at combo 0
   and combo 20.
5. **Budget violations on the accept path:**
   - `juice/motion.js flash()` animates `filter` and `box-shadow`, which breaks transform/opacity
     only. It does this ON THE INPUT, and DESIGN.md says not to animate inputs.
   - `fireAccept` calls `getBoundingClientRect()` on every accept. SAT `juice.js centerOf()` does the
     same per event.
   - The two infinite ComboMeter loops.
   - A full-viewport canvas flash on every word means a ~5120x2880 fill per frame at 2560/DPR2,
     repeated at 110 WPM, which is also a photosensitivity concern.

### 2.3 The ESCALATION LADDER (shared, pure: `src/juice/ladder.js` → `heatTier(count)`)
Tiers reuse ComboMeter's thresholds so the meter and the feel agree: **T0 0–1 · T1 2–3 · T2 4–6 ·
T3 7–9 · T4 10+**. CHAIN/FUSE feed `g.combo` count. SAT keeps its own heat/silver ladder, mapped onto
the same T0–T4 but drawn in ink (duotone retro-print stays).

| Per ACCEPT (fires same frame as the accept) | T0 | T1 | T2 | T3 | T4 |
|---|---|---|---|---|---|
| Word PUNCH scale (280ms, the accepted word / hype slot, never the input) | 1.06 | 1.09 | 1.12 | 1.16 | 1.20 |
| Particles from the shared pool (hard per-accept cap) | 10 | 16 | 22 | 30 | 40 |
| Ring radius px (× --wb-k on HUGE) | 110 | 130 | 150 | 170 | 190 |
| Hype word size | --fs-h2 | --fs-h2 | --fs-h1 | --fs-h1 | --fs-hero |
| Screen flash (full-screen, per word) | 0 | 0 | 0 | 0 | 0 |
| Edge frame (static class on the board edge in tier colour cyan→yellow→orange→pink; toggled, NOT animated) | none | cyan | yellow | orange | pink |
| validCue pitch | +0 | +2 st | +4 st | +7 st | +12 st (octave, capped) |

| Per TIER-UP (fires once, when the count crosses 2 / 4 / 7 / 10) | |
|---|---|
| Tier slam: ONE pooled node, WAAPI scale 0.6 → 1.12 → 1, opacity 0 → 1 → 0, **320ms in + 500ms hold + 200ms out** | label = "HOT" / "ON FIRE" / "UNSTOPPABLE" (≤2 words), --fs-h1 (T4 --fs-hero) |
| Single screen flash, alpha 0.10 / 0.12 / 0.14 / 0.16 | only on tier-up, never per word |
| Stinger: triangle arpeggio, 3 notes, +2 st per tier | |

| Rare / lucky / clutch (one LIGHT slot per accept, priority CLUTCH > LUCKY > RARE > tier-up > hype) |
|---|
| RARE in WB/Blitz: reuse `RarityFlash`, anchored to the reaction slot (not fixed 30%). It REPLACES that accept's hype word. 750ms. |
| LUCKY in WB/Blitz: reuse the solo gold ring + "LUCKY ×5" 400ms. App.jsx exposes the verdict it already draws (`drawLucky`) as a read-only prop (Tier 1 for the App.jsx line). |
| CLUTCH: unchanged (WB ClutchCallout, FUSE ClutchBurst 1.3s). |
| A lower-priority item that loses the slot degrades to a 13px+ tag line under the word, so it is never silent. |

| HEAVY moments (centre-screen, through `lib/moments.js`, one at a time, ≥250ms gap) |
|---|
| FRENZY start (1.8s) > CLUTCH burst (1.3s) > FRENZY/BOOST OVER (1.2s) > BOOST start. TimerOver joins the queue instead of mounting globally over a running burst. |
| Mid-game LEVEL-UP: LIGHT, not heavy. The LiveStack "LV n" chip re-keys a 240ms PUNCH + chime. The full celebration waits for the receipt / menu. |
| Combo break at T2+: the existing shatter (600ms). In CHAIN/FUSE, add the same shatter on the LiveStack COMBO row. |
| Game over: confetti 26 / 34 / 44 / 52 / 60 by the run's BEST tier, plus a "BEST STREAK n" line on the receipt. |

**Budget compliance.**
- All nodes are pre-mounted, one per slot: tier slam ×1, light slot ×1, LUCKY ring ×1. Replays use
  WAAPI on the same node. will-change goes on at play and is cleared on finish.
- `flash()` becomes an opacity pulse on a pre-mounted outline sibling (no filter, no box-shadow). The
  input is never animated.
- The input rect is measured on mount and on resize (cached through a ResizeObserver), never per accept.
- ComboMeter's spark and shake become finite (3 iterations on tier entry). That LOWERS the infinite count.
- No new infinite animations. The input-latency budget holds: all of the above is a handful of
  WAAPI starts per accept and zero layout reads.

### 2.4 Three versions
**V1 SUBTLE (fix the gaps).** Make lucky and rare visible in WB/Blitz, cap particles at 24, remove the
per-word white flash, add the level-up chip, convert ComboMeter's loops to finite, fix the `flash()`
and rect-read violations. No tier slams, no edge frame. PUNCH stays flat at 1.07.
+ Smallest diff, lowest risk.
− Does not deliver "a growing satisfying feel": combo 10 looks the same as combo 1.

**V2 ARCADE (the ladder above).** V1, plus the per-tier PUNCH, particle, ring and pitch, a tier slam on
each crossing, the static edge frame, the light-slot priority, and the heavy moments queued.
+ Every word gets clear feedback, the feel grows in 5 audible and visible steps, and nothing stacks.
  It reuses existing parts (RarityFlash, the solo lucky ring, moments.js, ComboMeter tiers).
− The tier slam competes with the prompt for "one big thing". It must sit in the reaction slot, never
  over the prompt or bomb (wb-text-overlap guards this).

**V3 MAXIMAL.** V2, plus a 2px board shake per accept at T3+, a 40ms hitstop on each tier-up,
per-letter SPRAY-REVEAL of every accepted word, beat-glow intensity tied to tier, and T4 particles
at 60.
+ The most "juice".
− Shaking the board while typing moves the caret, which DESIGN.md forbids (do not animate the input).
  A hitstop near the input path threatens the <50ms budget. Per-letter spray is N nodes per word
  (pool needed, ~12 nodes). Feedback starts stacking again, against Andy's "where they don't stack".

**RECOMMEND V2 ARCADE.** It is the only version that delivers "growing" without breaking "don't
stack". It also contains every V1 fix, so the budget violations get fixed either way. Ship V1's fixes
as the first commit of the branch, so they can be bisected.

### 2.5 Files that would change
- New `src/juice/ladder.js` + `ladder.test.js` (pure tier table).
- `src/juice/config.js` (the numbers above).
- `src/juice/motion.js` (`flash` → opacity).
- `src/components/GameScreen.jsx`: `fireAccept`, HypePopup slot, RarityFlash/lucky mount. This is
  **Tier 2**, but it sits next to the lastWordResult effect. Do not touch the effect's keying or the
  optimistic path.
- `ComboMeter.jsx/.css` · `RarityFlash.jsx/.css` (slot-anchored variant) · `solo/SoloShell.jsx`,
  `ChainGame.jsx`, `FuseGame.jsx` · `components/LiveStack.jsx` (LV chip, combo row pop) ·
  `frenzy/TimerOver.jsx` (enqueue instead of global mount) · `lib/moments.js` wiring ·
  `satRush/juice.js` (cache centres, ink-only ladder).
- **App.jsx (Tier 1):** pass the lucky verdict and the mid-game level-up signal down as read-only
  props. One task, diagnose-first, functional setView / FIFO untouched, 2-device play-test after.

### 2.6 Risks
- Rule P / payout honesty: the LUCKY ×5 label must match what `bankWordWins` actually credits
  (no-hidden-wins, payout-honesty).
- Optimistic WB accept: the tier slam fires on the optimistic accept. A server reject must roll the
  tier back silently, with no "tier lost" shatter for a word that never counted.
- Blitz is server-judged, so its feel fires on the broadcast. Expect ~RTT lag versus WB. Acceptable,
  but note it in the play-test.
- SAT input p95 is ~56ms today (input-latency comment). Its ladder must add zero React state per key.
- Reduced motion: the tier slam becomes an opacity-only label, the edge frame stays (static), and
  there are no particles or flashes. State stays legible.

### 2.7 Gates that catch regressions
- `e2e/input-latency` (CHAIN/FUSE/BLITZ ≤50ms, WB/SAT ≤80ms at 4x throttle).
- `splash-loops` (infinite count unchanged or lower) + unit `src/perf/willChange.test.js`.
- `wb-text-overlap` / `wb-readability` / `wb-ring` (the slam and slot never cover the prompt, bomb or
  seats, incl. 2560).
- `fuse-clutch` · `parity-wb-blitz` · `no-hidden-wins` / `no-hidden-wins-solo` / `payout-honesty`.
- `ko-screen` / `gameover-coverage` / `winner-bonus` · `word-bomb-scoring` (the optimistic path).
- `viewport-integrity` (the game-over at 7 viewports).
- **NEW `e2e/feel-ladder.spec.js`:**
  - force combo 0→10 via the existing test seams (`window.__TAW_LUCKY` style) and assert one tier slam
    per crossing;
  - assert ≤1 heavy moment painted at any time;
  - assert `document.getAnimations().length` stays under 60 at T4;
  - assert no animation targets `.game-input`;
  - assert lucky and rare each render a visible label in WB and Blitz.
- Tier 1 part: the REGRESSION CHECKLIST 2-device pass.
