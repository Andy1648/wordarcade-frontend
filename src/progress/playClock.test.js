// playClock.test.js — Andy oct21 "it says 0 seconds played … make sure that the time functionality works": every
// screen a game is PLAYED on must mount usePlayClock (Word Race + French Rush never did).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GAME_SCREENS = [
  'src/components/GameScreen.jsx', // Word Bomb, Category Blitz (multiplayer + solo)
  'src/solo/SoloShell.jsx', // CHAIN, FUSE
  'src/satRush/SatRushGame.jsx',
  'src/satRush/FrenchRushGame.jsx',
  'src/race/WordRaceScreen.jsx',
];

test('every game screen mounts the TIME PLAYED clock', () => {
  for (const f of GAME_SCREENS) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.match(src, /^\s*usePlayClock\(\);/m, `${f} must call usePlayClock()`);
  }
});
