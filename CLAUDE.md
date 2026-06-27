# TYPE A WORD - Project Guide

## Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express + WebSocket (ws)
- Deployment: Vercel (frontend), Render (backend)

## Design Style
- Newgrounds/FNF Flash cartoon aesthetic
- Flat colors ONLY, no gradients, no blur, no glow
- Thick COLORED outlines (darker shade of fill, not black except text strokes and shadows)
- Hard offset box-shadows in black
- Fonts: Bungee/Bungee Shade (display), Space Mono (body)
- Border-radius: 8px on cards/buttons
- All animations snappy (200-400ms for actions), never floaty
- Constant idle animations on all elements — nothing static
- Colors: #FF2EC4 (pink), #2EFFE0 (cyan), #FFE94A (yellow), #FF6B3D (orange), #9A1AFF (purple), #0d0618 (dark bg), #1a0b2e (panel bg)

## Rules
- Never add character illustrations via code — use the PNG mascot images in /public
- All SVG art should have personality: drips, overspray, asymmetry
- Sound effects use Web Audio API synthesis, no external audio files
- Mobile: all touch targets 44px minimum, font-size 16px minimum on inputs
- Categories must be niche and unexpected — no generic "things that are green" style
- Always verify build passes after changes: npx vite build --logLevel error

## Workflow (always follow, never ask)
- After ANY code change: run the full sequence yourself — edit → commit relevant files → push to current branch → report preview URL. Never end with uncommitted work.
- Never ask "want me to commit/push?" — just do it. Follow-up questions get dropped.
- Commit msg: short, conventional (feat:/fix:/docs:). Don't ask to approve.
- NEVER commit (unless told): LoadingScreen.jsx, .md audit reports, generated_content_review.js. Leave them untracked.
- After pushing, give the Vercel preview URL on its own line. User tests on preview, not localhost. Get it via `npx vercel ls wordarcade-frontend` (newest Preview row that's ● Ready).
- End every task with a one-line status: what's committed + the preview URL. No open questions.
- Keep responses short.

## Backend
- Located at: C:\Users\andyw_tnc0kix\Downloads\chain-reaction-backend\
- Push separately from frontend

## RISK TIERS — match ceremony to blast radius

Every task falls in one tier. Use the workflow for that tier. Do NOT apply Tier 1 rigor to Tier 3 work (wastes time) or Tier 3 looseness to Tier 1 work (breaks prod).

### TIER 1 — LIVE LOGIC (max caution, never loosen)
Files: App.jsx (WS message handlers, view/state lifecycle), useWebSocket.js, server.js, gameLogic.js, roomManager.js, wordBombBot.js, categoryBlitzLogic.js, aiValidator.js / haikuValidator.js (validation flow).
Anything touching: WebSocket messages, game state, turn logic, room lifecycle, the documented traps.
Workflow:
- ONE task at a time. Never batch.
- DIAGNOSE before fixing — if asked to fix a bug, trace and report the cause FIRST; do not push a speculative fix. If you cannot reproduce, STOP and report (no no-op commits).
- Supervised diff review before the next task.
- After shipping, a 2-device live play-test is required (see REGRESSION CHECKLIST).
- All documented traps apply (functional setView, live-view render, FIFO queue).

### TIER 2 — UI / COMPONENTS (moderate)
Files: GameScreen.jsx (rendering/layout, NOT its WS/state reads), RoomScreen.jsx, LobbyScreen.jsx, PublicRoomsScreen.jsx, ImposterWordScreen.jsx, component structure.
Workflow:
- May batch closely-related changes in one task.
- Review by PLAYING the preview, not by reading every diff line.
- Small judgment calls allowed; report them.
- If a "UI" change touches a WS handler or game-state read, it's TIER 1 — escalate.

### TIER 3 — STATIC / COSMETIC (loose, batch freely)
Files: all .css, copy/text, index.html meta, public/* static files, dead-code removal, assets, console-log gating.
Workflow:
- Batch aggressively. Trust the build (vite build, exit 0) to catch breakage.
- Spot-check the result; no line-by-line diff review needed.
- Cannot blank/freeze the app, so no live-test gate.

### ESCALATION RULE
When unsure which tier, pick the HIGHER one. A task that "looks like CSS" but changes a conditional render is Tier 1/2, not Tier 3.

## REGRESSION CHECKLIST — run after every TIER 1 change + every merge to main

90-second 2-device pass (laptop + phone, both HARD-REFRESHED). Diffs cannot catch runtime-only bugs (the key-collision freeze passed every code check and still froze). This catches them.

1. Load typeaword.com on both devices, hard-refresh.
2. Device A: CREATE ROOM. Device B: JOIN by code.
3. Device A: START a Word Bomb game.
4. CONFIRM: both devices enter the game (no freeze, no dark screen, non-host not kicked to waiting).
5. Play one full turn on each device (type a valid word, see it accepted).
6. Confirm a turn passes between players correctly.
7. (If WS/disconnect work was touched) Background the phone ~3s, foreground it — note behavior.
8. Open console on at least one device: 0 red errors, 0 key-collision warnings.

If any step fails → that's the regression, fix before anything else ships.

## Known Bugs — DO NOT REINTRODUCE
- App.jsx room_update handler MUST use a functional state update to guard the view:
  `setView(prev => prev === 'game' ? prev : 'room')`
  Do NOT rewrite this as `if (view !== 'game') { setView('room') }`. That version LOOKS correct but is broken: the WebSocket effect is keyed only on `[lastMessage]` and intentionally excludes `view` from its deps, so `view` read directly in the handler is STALE (captured from an earlier render). The stale read lets a room_update arriving after game_started kick non-host players back to the waiting screen. The functional setView reads live state and is the only correct form. This bug has been reintroduced multiple times because the broken version looks fine on inspection — verify the functional form is present.
- App.jsx screen MUST render off the live `view` state, never a lagging copy.
  TRAP: Do NOT make the rendered screen depend on a lagging copy of `view` (e.g. a `renderedView` state updated via setTimeout, or any delayed/cancelable swap). A previous version rendered off `renderedView`, updated by a 250ms setTimeout behind an early-return guard — when the timeout was cancelled or skipped, the screen stayed stranded even after `view` correctly became 'game', leaving non-host players stuck on the waiting/starting screen.
  RULE: The actual screen MUST render off the live `view` state, always and immediately. Screen transitions (the wipe/whoosh overlay) are PURELY cosmetic: position:fixed, pointer-events:none, on top of the already-correct screen. A transition effect may never gate, delay, or block which screen is shown.
- useWebSocket MUST buffer messages in a FIFO queue, never a single overwriting slot.
  TRAP: Do NOT expose WebSocket messages as a single overwriting state slot (e.g. `const [lastMessage, setLastMessage] = useState(null)` with onmessage overwriting it). When two frames arrive in the same tick (game_started immediately followed by room_update), React batches the setStates and the consumer only ever sees the LAST one — game_started gets silently dropped, setView('game') never runs, and the non-host is stuck on the waiting screen. This looks like the stale-closure bug but is NOT — the message was never seen, not overridden, so the functional setView guard can't protect against it.
  RULE: useWebSocket must buffer messages in a FIFO QUEUE (append every parsed frame). The App consumer must drain and process EVERY queued message in arrival order, never just the latest. No frame may be skipped on batched delivery.

## CANONICAL MENU TITLE (.homepage-logo) — do not flatten or alter without explicit request.
Wordmark: Bungee Shade font, #FF2EC4 fill, 5px #000 stroke, text-shadow: none (depth from the font, NO extrude). Menu-only: resting tilt rotate(-2deg) skewX(-4deg) and title-beat-pop on html[data-beat]. Defined in Homepage.css.
- DELIBERATE DIVERGENCE FROM SPLASH (menu-compaction): the menu title DROPS the continuous chromatic split (title-rgb-left/right ghosts are display:none) — it no longer matches the splash, on purpose. Do not "restore" it without explicit request. (Wordmark fill/stroke/pose/beat-pop above are still locked.)

## MENU MOTION LAW (Homepage) — idle removed, beat kept.
The menu has NO idle/ambient loops (the old tagline sway, section-label breathe, button idle bounce, and splatter parallax were removed to stop visual "jumping"). Every element keeps its STATIC resting pose (matching its reduced-motion state). Motion is concentrated into two beat-driven moments only: (1) title-beat-pop on .homepage-logo, (2) the .homepage-beat-glow soft pink frame glow. Hover/press feedback stays. The button beat-pop was removed (beat = title + frame glow only). Do not reintroduce idle loops here.
- DOCUMENTED FLAT-RULE EXCEPTION: .homepage-beat-glow is a pink radial-gradient pulse — an intentional, menu-frame-scoped exception to the "flat colors only, no gradients" rule. Opacity-only, beat-driven, reduced-motion-off.
