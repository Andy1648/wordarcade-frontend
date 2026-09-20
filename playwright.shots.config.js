// playwright.shots.config.js — the before/after CAMERA, deliberately not the gate.
//
// e2e-shots/ holds runs that produce ARTEFACTS (screenshots, censuses) rather than verdicts.
// They were briefly inside e2e/, where the main suite discovered them and ran 96 extra tests on
// every gate. A gate should answer one question; a camera should not be part of the answer.
//
// Run:  SHOTS=claude/shots/before npx playwright test --config=playwright.shots.config.js
import base from './playwright.config.js';

export default {
  ...base,
  testDir: './e2e-shots',
  retries: 0,
  reporter: [['line']],
};
