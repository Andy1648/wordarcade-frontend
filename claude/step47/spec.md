# STEP 47 spec — leaderboard pull-in (A13)

## Claim prompt (end screens: WB, Blitz, SAT, CHAIN, FUSE)
- Shows when ALL hold: board enabled; this browser has NO claimed name; the run ended with ≥1 accepted
  word; my stats' hypothetical rank ≤ 100 (BOARD_SIZE); not dismissed/shown before this SESSION
  (sessionStorage `taw.lb.promptShown`); storage available.
- Hypothetical rank = 1 + rows on the top-100 that rank ahead of me under the board's order
  (rebirths desc, level desc, lifetime_words desc; ties go to the existing row). One board fetch,
  at most once per session; fetch failure → no prompt (never an error on an end screen).
- Copy: "YOU'D BE #N" + "CLAIM YOUR NAME" button; ✕ dismiss (44×44). Tap → inline input (same
  filter + server verdict as the board) → CLAIM → "YOU'RE #N. SEE THE BOARD FROM THE MENU."
- Size: one row, ≤ 64px tall collapsed at 390px; never covers the end screen's primary button.
- Motion: slides in once (280ms, translateY 16px→0 + opacity) 600ms after mount; reduced motion =
  static. 0 infinite animations.

## Rank-up moment (menu)
- Claimed players only. On menu mount, after the stats push: read my rank; compare with
  localStorage `taw.lb.lastRank`. No stored rank → store silently. Improved (new < old) → moment +
  set `taw.lb.rankNews=1`. Worse/equal → store silently.
- Moment: a card "RANK UP" / "#12 → #7" centred over the menu: 2200ms total (in 260ms scale
  1.4→1 + opacity, old rank strikes out at 500ms, new rank pops at 700ms, hold to 1900ms, fade
  300ms). Reduced motion: static card for 2200ms. Tap dismisses. pointer-events only on the card.
- Trophy badge: pink dot (house SHOP-dot style) on the trophy button (desktop + phone) while
  `taw.lb.rankNews=1`; opening the board clears it and stores the current rank.

## Board never looks dead
- Fewer than 10 rows → pad to 10 with "#N — YOUR NAME HERE?" placeholder rows (muted, dashed
  outline). Never fabricated players. When the viewer is unclaimed, the FIRST placeholder row is a
  button that focuses the claim input.

## Anti-abuse (DB, migration 004 — revised after review, see review.md)
- New names per network (cf-connecting-ip, else last XFF hop; IPv6 by /64; hashed): ≤ 20/hour, ≤ 60/day,
  under advisory locks. No usable IP → no per-IP bucket, but a 600/hour site-wide ceiling.
- Per browser: one profile per secret; renames free within 10 min of the claim, then 1 per 24 h
  (row-locked). Errors `rate_limited`, `rename_cooldown` (HTTP 400).
- Stats: 5 s per-row throttle (003) + honest-play shape: rebirths/words never decrease, level only drops
  with a rebirth, words ≤ 20/s of elapsed time after the first push; violating pushes are ignored.
- Claim logs older than 2 days are pruned on each new-name claim.
- Prompt trigger uses LIFETIME words ≥ 1 (the board ranks lifetime stats).

## Acceptance
- e2e (mocked API): fresh profile plays a solo round → prompt "YOU'D BE #N" → claims → board shows the
  name → rank improves → next menu shows "#a → #b" and the trophy badge; opening the board clears it.
- Probe vs live DB: 21st new claim from one network in an hour → `rate_limited`; 2nd rename in a day →
  `rename_cooldown`; 10 submits in 1s → 1 applied.
- 0 running / 0 infinite animations at rest on menu and end screens after the moments finish.
- Bot sim (weak / median / strong) reports which see the prompt at a 0-, 10- and 150-player board.
