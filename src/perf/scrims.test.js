// scrims.test.js — every full-screen modal dims the page by the same amount (--scrim in index.css). A new modal joins this list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIMS = [
  [
    'claims/ClaimsPanel.css',
    '.claims-overlay'
  ],
  [
    'components/account/AuthLanding.css',
    '.al-scrim'
  ],
  [
    'components/AchievementsScreen.css',
    '.ach-overlay'
  ],
  [
    'components/CollectionScreen.css',
    '.coll-overlay'
  ],
  [
    'components/LeaderboardScreen.css',
    '.lb-overlay'
  ],
  [
    'components/LockedPreviewDialog.css',
    '.lp-scrim'
  ],
  [
    'components/ModeDialog.css',
    '.mode-dialog-scrim'
  ],
  [
    'components/OverlaySkeleton.css',
    '.ovsk-overlay'
  ],
  [
    'components/patchNotes/PatchNotes.css',
    '.pn'
  ],
  [
    'components/profile/ProfilePopup.css',
    '.pf-scrim'
  ],
  [
    'components/ProfileCard.css',
    '.pc-scrim'
  ],
  [
    'components/rollScreen/RatesPop.css',
    '.rs-rates-scrim'
  ],
  [
    'components/SettingsPanel.css',
    '.sp-scrim'
  ],
  [
    'components/ShopScreen.css',
    '.shop-overlay'
  ],
  [
    'components/ShopV2.css',
    '.sp2-pop'
  ],
  [
    'components/StatsScreen.css',
    '.stats-overlay'
  ],
  [
    'components/wheel/DailyWheel.css',
    '.dw-scrim'
  ],
  [
    'cast/RoomHeroButton.css',
    '.rh-scrim'
  ],
  [
    'components/Sticker.css',
    '.sticker-backdrop'
  ],
  [
    'components/GearSheet.css',
    '.mx-sheet-layer'
  ]
];

for (const [file, sel] of SCRIMS) {
  test(`${sel} uses the one modal dim`, () => {
    const css = readFileSync(join(SRC, file), 'utf8');
    const at = css.search(new RegExp(`(^|\\n)${sel.replace(/[.-]/g, (c) => `\\${c}`)}\\s*\\{`));
    assert.ok(at >= 0, `${sel} not found in ${file}`);
    const block = css.slice(at, css.indexOf('}', at));
    assert.match(block, /background(-color)?:\s*var\(--scrim\)/, `${sel}: ${block.slice(0, 120)}`);
  });
}

test('--scrim is defined once, in index.css', () => {
  assert.match(readFileSync(join(SRC, 'index.css'), 'utf8'), /--scrim:\s*rgba\(/);
});
