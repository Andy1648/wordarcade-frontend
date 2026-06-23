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

## Backend
- Located at: C:\Users\andyw_tnc0kix\Downloads\chain-reaction-backend\
- Push separately from frontend

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
