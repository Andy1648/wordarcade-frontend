// Screenshot harness for STEP 47 (not part of the gate): reuses the e2e config + mocks.
import base from '../../playwright.config.js';
export default { ...base, testDir: '.', testMatch: /shots\.spec\.js/, reporter: [['line']], retries: 0 };
