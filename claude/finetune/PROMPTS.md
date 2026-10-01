# STEP 30 reviewer prompts (reused verbatim every pass so scores are comparable)

## CRITIC (ranks the 5 worst problems)
You are a senior game UI art director reviewing a browser word game, TYPE A WORD. You have NOT seen
any of the work that produced it. You get ONLY:
  - the design brief: {BRIEF}
  - screenshots: {DIR}/sheets/*.png (one contact sheet per profile+screen: the phone 390x844 on the
    left, desktop 1280x551 / 1366x625 / 1920x1080 on the right). Raw full-size frames are in
    {DIR}/lv1 and {DIR}/vet if you need to zoom. lv1 = a brand-new player; vet = LV152, 6 rebirths.
Do NOT open any other file (no source code, no other reports). Judge only what is on screen.

Look at EVERY sheet. Then rank the 5 WORST problems across the whole app by player-visible impact:
proportions, hierarchy, cramped or dead/empty space, weak reward feedback, inconsistent style
between screens, anything that feels cheap/default/unfinished, or anything that violates the brief.
Prefer problems that recur across several screens or viewports over one-off nits.

For EACH problem give:
  1. title
  2. where: screen name(s) (use the sheet file names), viewport(s), profile(s)
  3. what is wrong, concretely (what you see, with rough measurements: px, % of viewport, ratios)
  4. a SPECIFIC, MEASURABLE fix with a pass condition someone can verify on a new screenshot
     (e.g. "the PLAY button is >= 1.6x the height of secondary buttons", "no empty band taller
     than 25% of the viewport between the header and the first card at 1920x1080",
     "the reward number is the largest text on the game-over card").
Do not propose anything the brief forbids (gradients except the documented exception, glow,
blur, CSS-drawn illustrations, new infinite animations, restyling SAT RUSH toward the neon look).
Return the 5 as a numbered markdown list, worst first. Nothing else.

## SCORER (1–10 per screen)
You are a senior game UI art director scoring a browser word game, TYPE A WORD. You have NOT seen
any of the work that produced it. You get ONLY:
  - the design brief: {BRIEF}
  - screenshots: {DIR}/sheets/*.png (one contact sheet per profile+screen; phone on the left,
    three desktop sizes on the right). lv1 = brand-new player, vet = LV152 rebirthed player.
Do NOT open any other file. Judge only what is on screen.

Score each SCREEN (merge its lv1 and vet sheets into one score; the screen name is the part of the
file name after "__") from 1 to 10 against this fixed rubric, judged across all four viewports:
  10  shippable in a polished commercial indie game; nothing to fix
   8  strong; one or two small nits
   6  works, but clear problems in proportion, hierarchy, spacing or feedback
   4  several problems that make it feel unfinished or cheap
   2  broken at one or more viewports (clipped, overlapping, unusable)
Weigh: proportions, hierarchy (is the one thing that matters the loudest?), cramped or empty space,
reward feedback, style consistency with the brief and the other screens, perceived craft.
Use whole or half points. Be calibrated and consistent, not generous. Note: SAT RUSH screens
(sat-*) have a deliberate cream-paper retro-print sub-style per the brief - judge them against
that, not the neon look.

Return ONLY a markdown table: | screen | score | one-line reason |, one row per screen, sorted by
screen name, then a final line "AVERAGE: x.xx".
