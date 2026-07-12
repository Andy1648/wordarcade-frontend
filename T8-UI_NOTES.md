# T8 UI Notes — every screen/state a player sees

Frontend: Vite + React 18, plain CSS file per component (no CSS framework, no styled-components).
Aesthetic: graffiti/neon "TYPE A WORD" — Bungee + Space Mono fonts, locked 5-colour palette
(#FF2EC4 pink / #2EFFE0 teal / #FFE94A yellow / #FF6B3D orange / #9A1AFF purple), hard-edged
shadows (no blur), black text strokes. `src/juice/` is a shared game-feel toolkit (squash, flash,
burst, shake, hitStop, synthesized sfx, tension drone); `useSoundEffects` is the older per-screen
synthesized SFX hook (tick, heartbeat, correctDing, wrongBuzz, victory, defeat, ko, whoosh…).
View routing is a single `view` state in `App.jsx` (home | lobby | browse | room | game | credits)
with a cosmetic Persona-5 bar wipe on every change.

## Screen/state inventory

### Boot chain (once per session)
1. **LoadingScreen** — bomb-fuse burn, fixed-duration, explodes and hands off (socket connects in background).
2. **SplashScreen** — attract screen; the dismiss click is the audio-unlock gesture.
3. **TransitionIntro** — anime fight-card ("TYPE FAST. / DIE SLOW.") on black.
4. **KnifeSplit** — blade-slice reveal of the menu. All skipped in portal builds (`?portal=1`).

### Menu & matchmaking
5. **Homepage** — game cards (Word Bomb / Category Blitz / Imposter Word), CREATE/JOIN, credits link, Blitz pack-picker dialog (ModeDialog + PackPicker).
6. **LobbyScreen** — name entry (+ room code on join path), public/private toggle on create.
7. **PublicRoomsScreen** (browse) — join-by-code + auto-refreshing public list. Has proper loading pulse ("SCANNING FOR GAMES…") AND a friendly empty state with a CREATE PUBLIC ROOM CTA. Not neglected.
8. **RoomScreen** (waiting room) — code + WaveText, roster chips (slam-in entrance per join, join pop sound), waiting mascot (bored sway) when under min players, ADD BOT flow for solo, game-mode + difficulty pickers (host) / read-only (guest), START/LEAVE. Non-host sees "WAITING FOR HOST…". Not neglected.
9. **CreditsScreen**.

### In-game: Word Bomb (GameScreen.jsx, the most-juiced mode)
10. **3-2-1-GO countdown** overlay (per game).
11. **Active turn — my turn** — bomb visual with burning fuse + tension tiers (calm/warning/critical: bomb scale, flame scale, mascot pose), input focused, per-keystroke sounds + live typing relay, SweatDrops on panic, timer bar (urgent pulse ≤5s, number jitter <3s), heartbeat audio, ambient WallScene intensity ramps via App.
12. **Active turn — someone else's** — LiveTypeText shows their keystrokes, bomb flies to them (bomb-pass throw animation).
13. **Submit accepted** — word flies at the bomb (FlyingWord/SubmitLetters per-letter physics), hype popup (NICE!/CLUTCH! words), combo meter, floating score, hitlag/impact frame, medium shake, correctDing/combo sounds, clutch callout when accepted with ≤2s left.
14. **Submit rejected** — reject scatter (ShatterWord), wrongBuzz, rejection toast with reason, combo break.
15. **Life lost / elimination** — heart shatter, KO slam overlay (fighting-game style), heavy shake, kill-feed flavor line ("{player} got DELETED."), explosion effect w/ debris.
16. **Spectating (just-eliminated)** — "YOU'RE OUT — SPECTATING" banner, emoji quick-react buttons replace the input, reactions float up for everyone, spectator count shown, red colour-temperature wash deepens as players die. Decent, not blank.
17. **Game over** — winner/loser variants (WinBurst confetti vs LossImpact shockwave + ELIMINATED slam card), stats panel (headline numbers, per-player, awards), ShareBar, REMATCH (host) / LEAVE.

### In-game: Category Blitz (CategoryBlitzScreen inside GameScreen.jsx)
18. **Round countdown → active round** — category display, answer input, per-answer accept ding / reject buzz, per-letter submit physics, streak/combo, clutch callouts, reactive mascot (celebrate/panic), per-second urgency-pitched tick + final-5s accelerating heartbeat, reroll button (host), "checking…" indicator while the AI fallback judges.
19. **Between rounds** — round results + sample answers + countdown to next.
20. **Final scoreboard** (multiplayer) / **SoloResultsScreen** with personal-best celebration (localStorage PBs, score count-up).

### In-game: Imposter Word (ImposterWordScreen.jsx) — LEAST JUICED MODE
21. **Answering phase** — category (or "YOU ARE THE IMPOSTER / blend in"), 3-answer input, live answer feed, timer bar w/ urgent class. **Gap: no per-second tick, no final-5s heartbeat, no accept/reject SFX (toast only), no input feedback physics** — Word Bomb and Blitz both have all of these.
22. **Voting phase** — vote cards per player with their answers, vote progress count, VOTE buttons. **Gap: vote buttons ~33px tall (worst touch target in the app), no lock-in feedback beyond colour swap.**
23. **Reveal** — 2s suspense → name slam (punch + heavy shake), verdict, real category, votes, score count-ups, next-round countdown. Already dramatic.
24. **Imposter game over** — scoreboard, detective/imposter awards, ShareBar, rematch/leave.

### Error / edge states
25. **CONNECTION LOST overlay** (App.jsx ~1466) — blocking overlay when the socket drops mid room/game (seat unrecoverable). Functional but the flattest surface in the app: plain inline styles, no entrance animation, no mascot, no sound. Neglected.
26. **Server error toasts** — room-level errors surface next to START (RoomScreen), lobby/browser errors inline. friendlyError() rewrites raw messages.
27. **"STARTING GAME..."** fallback (ImposterWordScreen) when phase data hasn't arrived.
28. **Loading-screen socket-error retry** (LoadingScreen onRetry → reload).

## Prior audits already in the working tree (untracked, by another session)
- `mobile_audit.md` — 4 unfixed touch-target findings: `.iw-vote-btn` (~33px, worst), `.room-gametype-btn`/`.room-difficulty-btn` (~30–40px), `.cb-reroll-btn` (~38px), credits links. Inputs are all ≥16px (no iOS zoom); overflow is clean; primary buttons already 44px on phones.
- `design_audit.md` — palette/border-style conformance findings (black borders on colored fills, white input backgrounds, off-palette red). Explicitly design-rule work, not game feel — left to the session that owns the design rules.

## T8 plan derived from this map
1. JUICE: bring Imposter Word to audio/feedback parity (tick, heartbeat, ding/buzz, input flash/burst via the `src/juice` toolkit) — the reveal is already great, the answering phase is silent.
2. MOBILE: fix the 4 concrete touch-target findings from mobile_audit.md.
3. DEAD STATES: give CONNECTION LOST a proper dramatic treatment (slam-in, mascot, defeat sting) consistent with the brand.
4. Verify lint + build after each change; commit per improvement.
