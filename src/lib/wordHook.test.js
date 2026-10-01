import test from 'node:test';
import assert from 'node:assert/strict';
import { hookPromptFor, cleanHookWord, HOOK_MAX_LEN } from './wordHook.js';

test('German browsers get the German prompt, everyone else the English one', () => {
  for (const l of ['de', 'de-DE', 'de-AT', 'DE-ch']) assert.equal(hookPromptFor(l).text, 'TIPP EIN WORT 👇');
  for (const l of ['en-US', 'fr', 'nl-NL', '', undefined, null]) assert.equal(hookPromptFor(l).text, 'TYPE A WORD 👇');
  assert.equal(hookPromptFor('de-DE').lang, 'de');
});

test('the typed word is letters only, upper-cased, capped', () => {
  assert.equal(cleanHookWord('banana'), 'BANANA');
  assert.equal(cleanHookWord('  hi!! 123 '), 'HI');
  assert.equal(cleanHookWord('Straße'), 'STRASSE'.slice(0, HOOK_MAX_LEN));
  assert.equal(cleanHookWord('grüße'), 'GRÜSSE');
  assert.equal(cleanHookWord('🔥🔥'), '');
  assert.equal(cleanHookWord('supercalifragilistic').length, HOOK_MAX_LEN);
});
