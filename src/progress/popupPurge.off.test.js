// popupPurge.off.test.js — P7 POPUP PURGE: WITH THE SEASON2 FLAG OFF, NOTHING CHANGES.
// Every purge branch is gated on the flag (or on a V3.* hook that only the season-2 chunk installs), so the live game
// keeps its level-up card, rank-up card, claim popup, NEW SYSTEM sticker, wins toasts, WINNER popup, claim prompt,
// near-miss line, wall stamp, shop sticker and spotlight tutorials exactly as they are. This pins it two ways:
//   1. RUNTIME — the flag is off, the V3 holder is empty, so the MenuXpFx handle hook is the identity and the claim
//      inbox still fills (the menu's claim popup has its claims);
//   2. SOURCE — each purged component's season-2 path is behind SEASON2, and its live path is still there.
// The flag-ON side is v3/notify.test.js (its own process: the flag is fixed at module load).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size; },
};

const S = await import('./season.js');
const C = await import('./claims.js');

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(SRC, p), 'utf8');

test('OFF: the flag is off and no season-2 UI hook is installed (V3.fx / Notify / toast / rankUp)', () => {
  assert.equal(S.SEASON2, false);
  for (const k of ['fx', 'Notify', 'toast', 'rankUp', 'Trophy']) assert.equal(S.V3[k], undefined, `V3.${k}`);
});

test('OFF: the MenuXpFx handle hook is the identity — every centre card (LEVEL N, NEW FRAME, REBIRTH, +N WINS) is the live one', () => {
  const api = { celebrate() {}, tierUp() {}, announce() {}, rebirthCelebration() {}, rebirthRush() {}, winsStamp() {}, winsHint() {}, letterPop() {} };
  // MenuXp.jsx: useImperativeHandle(ref, () => (V3.fx || Object)({ ... }))
  const handle = (S.V3.fx || Object)(api);
  assert.equal(handle, api, 'the very same object');
  for (const k of Object.keys(api)) assert.equal(handle[k], api[k], k);
  assert.match(read('components/MenuXp.jsx'), /useImperativeHandle\(ref, \(\) => \(V3\.fx \|\| Object\)\(\{/);
});

test('OFF: the claim inbox still fills, so the menu claim popup / REWARDS count work as live', () => {
  mem.clear();
  C.queueClaim({ id: 'ach-x', kind: 'achievement', label: 'X', amount: 10 });
  C.queueClaim({ id: 'rank-y', kind: 'rank', label: 'Y', amount: 10 });
  assert.deepEqual(C.listClaims().map((c) => c.id).sort(), ['ach-x', 'rank-y']);
  assert.equal(C.claimPolicy('achievement'), 'inbox');
  assert.equal(C.claimPolicy('rank'), 'inbox');
});

// file → [the season-2 gate (must be present), a marker of the LIVE path that must still be there]
const GATES = [
  ['components/WinnerPopup.jsx', /return SEASON2 \? null : <WinnerPopupLive \{\.\.\.props\} \/>/, /function WinnerPopupLive\(\{ pay \}\)/],
  ['leaderboard/ClaimPrompt.jsx', /return SEASON2 \? null : <ClaimPromptLive \{\.\.\.props\} \/>/, /function ClaimPromptLive\(\)/],
  ['components/NearMiss.jsx', /return SEASON2 \? null : <NearMissLive \{\.\.\.props\} \/>/, /function NearMissLive\(/],
  ['claims/ClaimReveal.jsx', /return SEASON2 \? <S2Reveal \{\.\.\.props\} \/> : <ClaimRevealLive \{\.\.\.props\} \/>/, /ribbon="★ NEW SYSTEM ★"/],
  ['leaderboard/RankUpMoment.jsx', /if \(SEASON2\) \{[\s\S]*?return undefined;\s*\}\s*const a = setTimeout/, /className="lb-rankup"/],
  ['leaderboard/RankUpMoment.jsx', /if \(SEASON2\) return null;/, /className="lb-rankup-layer"/],
  ['leaderboard/DevResetNotice.jsx', /if \(SEASON2\) \{[\s\S]*?return undefined;\s*\}\s*const t = setTimeout/, /YOUR PROGRESS WAS RESET BY THE DEV\.<\/p>/],
  ['tutorials/TutorialHost.jsx', /if \(!SEASON2 \|\| !due \|\| !on\) return;/, /if \(SEASON2 \|\| !due \|\| !on\) return null;\s*return \(\s*<SpotlightTutorial/],
  ['components/WinsCreditToast.jsx', /if \(SEASON2 \|\| !entry \|\| entry\.kind !== 'bonus' \|\| entry\.amount <= 0\) return;/, /className="wct"/],
  ['components/wallFx.jsx', /if \(!fx \|\| SEASON2\) return null;/, /<div className="wall-stamp-sub">NEW WALL<\/div>/],
  ['components/ShopScreen.jsx', /\{reveal && \(SEASON2 \? <S2BuyToast reveal=\{reveal\} onDone=\{\(\) => setReveal\(null\)\} \/> : <ShopReveal reveal=\{reveal\} onDone=\{\(\) => setReveal\(null\)\} \/>\)\}/, /return <ShopSticker reveal=\{reveal\}/],
  ['components/ShopScreen.jsx', /\{SEASON2 && V3\.Notify && <V3\.Notify \/>\}/, /\{ceremony && <RebirthCeremony c=\{ceremony\} onContinue=\{onBack\} \/>\}/],
];

test('OFF: every purged popup keeps its live path, behind a SEASON2 gate', () => {
  for (const [file, gate, live] of GATES) {
    const src = read(file);
    assert.match(src, gate, `${file}: season-2 gate`);
    assert.match(src, live, `${file}: live path`);
  }
});

test('OFF: the purge never reaches for a V3.* hook outside a SEASON2 gate', () => {
  // the lazy chunks call V3.toast / V3.rankUp only inside a branch that SEASON2 already chose
  const uses = [
    ['claims/ClaimReveal.jsx', /function S2Reveal[\s\S]*V3\.toast\(/],
    ['tutorials/TutorialHost.jsx', /if \(!SEASON2 \|\| !due \|\| !on\) return;\s*V3\.toast\(/],
    ['leaderboard/RankUpMoment.jsx', /if \(SEASON2\) \{[\s\S]*V3\.rankUp\(/],
    ['leaderboard/DevResetNotice.jsx', /if \(SEASON2\) \{[\s\S]*V3\.toast\(/],
    ['components/ShopScreen.jsx', /function S2BuyToast[\s\S]*V3\.toast\(/],
  ];
  for (const [file, re] of uses) assert.match(read(file), re, file);
});
