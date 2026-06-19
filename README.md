# WordArcade frontend

React + Vite homepage/lobby screen for WordArcade. This build's scope is
intentionally just the game-selection grid - no routing, no room flow,
no WebSocket connection yet. Those are separate follow-up pieces.

## Status: what's verified vs. what isn't

This was built in a sandboxed environment with **no internet access**,
which means `npm install` could not actually run here. Concretely:

- **Not verified:** the app has never been built or run through Vite's
  actual dev server, since that requires `node_modules` (react, vite,
  the React plugin) which could not be fetched from the npm registry.
- **Verified:** every `.jsx`/`.js` file was checked for real syntax
  validity using a transform-based check (not just "it looks right") -
  confirmed by deliberately introducing a JSX syntax error into one file
  and observing a distinctly different error type, then restoring it and
  confirming the error disappeared. The remaining errors seen during
  checking were only ever "unknown file extension .css" (an artifact of
  the checking method not understanding CSS imports the way Vite does,
  not a real bug) or "package not found" for `react` (expected, since
  there's no local `node_modules`).
- **Verified:** the data contract between `gameData.js` and the two
  component lookup maps (`GAME_ART_COMPONENTS`, `GAME_ICON_COMPONENTS`)
  - confirmed all 6 games resolve to a real art component and a real
  icon component with no missing or mismatched keys.

In short: the code should be syntactically sound and the data wiring is
confirmed correct, but the very first real test of "does this actually
render correctly in a browser" still needs to happen on a machine with
internet access, via `npm install && npm run dev`.

## Setup

```bash
npm install
npm run dev      # starts Vite's dev server, prints a local URL to open
npm run build    # production build, outputs to dist/
```

## Structure

```
src/
  gameData.js              - plain data describing all 6 games (name,
                              colors, description, which art/icon to use)
  components/
    Homepage.jsx / .css     - the lobby screen: logo, label, card grid, buttons
    GameCard.jsx / .css     - one card, handles its own hover-reveal animation
    GameArt.jsx             - the 6 larger hover-reveal SVG illustrations
    GameIcons.jsx           - the 6 small always-visible icon glyphs
  App.jsx                   - currently just renders Homepage
  main.jsx                  - React entry point
  index.css                 - global reset/base styles only
```

Adding a 7th game later means: one new entry in `gameData.js`, one new
exported component in `GameArt.jsx`, one new exported component in
`GameIcons.jsx`. `GameCard.jsx` itself never needs to change since it
looks both up dynamically by key.

## Design notes carried over from the locked visual reference

- Flat cel-shaded style throughout: hard-edged flat-color shapes for
  highlights/shadows, no gradients, no blur or glow filters anywhere.
- Card press/lift uses only `transform` + hard offset `box-shadow`
  (no soft shadow blur) to keep the "comic panel" feel.
- Hover reveals art via opacity + scale only, 180ms, no blur transition.
- Fonts: Bungee for display/titles, Space Mono for body text - both
  loaded via Google Fonts in `index.html`.

## Known gaps / next steps

1. Run `npm install` somewhere with real network access - this is the
   actual first test of whether this renders correctly.
2. `onSelectGame`, `onPlaySolo`, `onJoinRoom` props on `Homepage` exist
   but have no real implementation yet - they currently just
   `console.log` when not provided. Wiring these to real navigation/room
   creation is the next piece of work.
3. No connection to the Chain Reaction WebSocket backend yet - this
   screen doesn't talk to the server at all right now.
