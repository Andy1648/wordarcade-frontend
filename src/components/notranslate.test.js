// notranslate.test.js — build-failing guard for the translate-extension crash fix.
//
// Browser translate extensions swap text nodes out from under React. On a screen whose
// text is rewritten every second (player names, the word feed, the timer) React's next
// reconcile then calls removeChild on a node that is no longer there — the production
// "NotFoundError: Failed to execute 'removeChild' on 'Node'" seen on /room/:code in Edge.
// The fix is the notranslate meta plus translate="no" on exactly the VOLATILE nodes.
//
// This test pins BOTH halves. It scans the source rather than a rendered tree because the
// repo's unit runner is plain `node --test` (no JSX transform) — so it checks that each
// listed element still carries the attribute, which is what actually ships.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// Every element holding text that the SERVER or the player changes mid-render. Each entry is
// the className as written in the JSX; the element must carry translate="no" on the same tag.
const PROTECTED = {
  'src/components/GameScreen.jsx': [
    'submit-letters',          // per-letter answer physics (one text node per glyph)
    'player-typing-text',      // live opponent typing, re-keyed per keystroke
    'kill-feed',               // the live word feed
    'bomb-vignette',           // WB fuse timer (seconds in an SVG <text> inside)
    'game-timer-num',          // CB seconds readout
    'game-player-name-text',   // WB player card name
    'go-player-name-text',     // WB game-over name
    'cb-progress-name-text',   // CB live rail name
    'cb-result-name-text',     // CB round-results name
    'cb-score-name-text',      // CB final scoreboard name
    'game-combo',              // the WB prompt fragment / CB category
    'game-used-list',          // used-word chips
    'cb-answers-list',         // your CB answers
    'cb-result-answers',       // everyone's CB answers
    'cb-missed-answers',       // the answers-you-missed list
  ],
  'src/components/RoomScreen.jsx': [
    'room-code',               // an identifier — must never be translated
    'room-player-name',        // lobby roster name
  ],
};

// Find the OPENING TAG that carries this className and return its full text, so the caller can
// check the attributes on that one element. Handles both JSX spellings — className="name" and
// className={`name...`} — and requires the name to end at the closing quote or at a `$`/space
// inside the template, so asking for `game-combo` never matches `game-combo-punch`.
const NAME_END = /[$`\s"]/; // what may legally follow the class name we asked for

function openingTagFor(source, className) {
  const needle = 'className=';
  let from = 0;
  for (;;) {
    const at = source.indexOf(needle, from);
    if (at === -1) return null;
    from = at + needle.length;
    // The character after `className=` is either a quote or `{` + a backtick.
    const bodyAt = source.startsWith('"', from) ? from + 1
      : source.startsWith('{`', from) ? from + 2
      : -1;
    if (bodyAt === -1 || !source.startsWith(className, bodyAt)) continue;
    const next = source.charAt(bodyAt + className.length);
    if (next && !NAME_END.test(next)) continue; // a LONGER class name — keep looking
    // Walk out to the tag's own `<` … `>` (JSX attribute values here contain neither).
    const open = source.lastIndexOf('<', at);
    const close = source.indexOf('>', at);
    if (open === -1 || close === -1) continue;
    return source.slice(open, close + 1);
  }
}

for (const [file, names] of Object.entries(PROTECTED)) {
  test(`${file} keeps translate="no" on every live-text node`, () => {
    const src = read(file);
    const missing = [];
    for (const name of names) {
      const tag = openingTagFor(src, name);
      if (!tag) {
        missing.push(`${name} -> element not found (renamed? update this list)`);
      } else if (!/\btranslate="no"/.test(tag)) {
        missing.push(`${name} -> opening tag has no translate="no"`);
      }
    }
    assert.deepEqual(missing, [], `live game text unprotected from translate extensions:\n${missing.join('\n')}`);
  });
}

test('index.html opts out of auto-translate but does NOT notranslate the whole page', () => {
  const html = read('index.html');
  // Strip comments so the prose explaining the rule can't satisfy (or trip) the assertions.
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.match(markup, /<meta\s+name="google"\s+content="notranslate"\s*\/?>/);
  // The static copy (menu, rules, SEO text) must stay translatable by hand.
  assert.doesNotMatch(markup, /<(html|body)[^>]*\btranslate="no"/);
  assert.doesNotMatch(markup, /<(html|body)[^>]*\bclass="[^"]*\bnotranslate\b/);
});
