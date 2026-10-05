// node --test — the challenge link's pure helpers (claude/specs/challenge-link.md v1).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChallengeUrl,
  parseChallenge,
  clampChallenge,
  cleanName,
  secText,
  chipText,
  challengeVerdict,
  senderResult,
  shareText,
  saveChallenge,
  readChallenge,
  clearChallenge,
  captureChallengeFromUrl,
  CHALLENGE_KEY,
  FALLBACK_NAME,
} from './challenge.js';

function memStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

test('build -> parse round-trips, three params, short link', () => {
  const url = buildChallengeUrl({ vs: 'Xavi', t: 41200, n: 25 }, 'https://typeaword.com');
  assert.equal(url, 'https://typeaword.com/race/play?vs=XAVI&t=41200&n=25');
  assert.ok(url.length < 80);
  const c = parseChallenge(new URL(url).search);
  assert.deepEqual(c, { vs: 'XAVI', t: 41200, n: 25 });
});

test('clamps: t to 5-600 s, n to 5-100, garbage -> null', () => {
  assert.deepEqual(clampChallenge({ vs: 'A', t: 1, n: 1 }), { vs: 'A', t: 5000, n: 5 });
  assert.deepEqual(clampChallenge({ vs: 'A', t: 9e9, n: 999 }), { vs: 'A', t: 600000, n: 100 });
  assert.equal(clampChallenge({ vs: 'A', t: 'abc', n: 25 }), null);
  assert.equal(parseChallenge('?vs=A&n=25'), null);
  assert.equal(parseChallenge('?vs=A&t=&n=25'), null);
  assert.equal(parseChallenge('?t=41200.7&n=24.6').t, 41201);
});

test('names are re-filtered on read: shape, length, blocklist', () => {
  assert.equal(cleanName('<script>alert(1)</script>'), 'SCRIPTALERT1SCRI');
  assert.equal(cleanName('a'.repeat(40)).length, 16);
  assert.equal(cleanName('fuck'), '');
  assert.equal(parseChallenge('?vs=sh1tlord&t=41200&n=25').vs, FALLBACK_NAME);
  assert.equal(parseChallenge('?t=41200&n=25').vs, FALLBACK_NAME);
  // URL-encoded space survives as a space
  assert.equal(parseChallenge('?vs=big%20al&t=41200&n=25').vs, 'BIG AL');
});

test('secText: 0.1 s precision, always one decimal', () => {
  assert.equal(secText(41200), '41.2');
  assert.equal(secText(41000), '41.0');
  assert.equal(secText(3249), '3.2');
});

test('chip copy: same target vs a different target', () => {
  const c = { vs: 'XAVI', t: 41200, n: 25 };
  assert.equal(chipText(c, 25), 'BEAT XAVI: 41.2s');
  assert.equal(chipText(c, 12), 'BEAT XAVI: 25 WORDS IN 41.2s');
  assert.equal(chipText(null, 25), '');
});

test('verdict: same target + finished -> time diff', () => {
  const c = { vs: 'XAVI', t: 41200, n: 25 };
  assert.deepEqual(challengeVerdict(c, { words: 25, ms: 38000 }, 25), { win: true, text: 'YOU BEAT XAVI BY 3.2s' });
  assert.deepEqual(challengeVerdict(c, { words: 25, ms: 42300 }, 25), { win: false, text: 'XAVI WINS BY 1.1s' });
  assert.equal(challengeVerdict(c, { words: 25, ms: 41200 }, 25).text, 'DEAD HEAT WITH XAVI');
});

test('verdict: different target or unfinished -> words per second', () => {
  const c = { vs: 'XAVI', t: 40000, n: 20 }; // 0.5 words/s
  assert.deepEqual(challengeVerdict(c, { words: 25, ms: 40000 }, 25), { win: true, text: 'YOU WERE FASTER' });
  assert.deepEqual(challengeVerdict(c, { words: 10, ms: 40000 }, 25), { win: false, text: 'XAVI WAS FASTER' });
  // same target but I did not finish: rate comparison, never a fake time diff
  const same = { vs: 'XAVI', t: 41200, n: 25 };
  assert.equal(challengeVerdict(same, { words: 20, ms: 60000 }, 25).text, 'XAVI WAS FASTER');
  assert.equal(challengeVerdict(same, { words: 0, ms: 0 }, 25).text, 'XAVI WAS FASTER');
  assert.equal(challengeVerdict(null, { words: 25, ms: 1 }, 25), null);
});

test('senderResult: from my race_over standing; needs >= 5 words and a time', () => {
  assert.deepEqual(senderResult({ words: 25, reachedAt: 41234 }), { n: 25, t: 41234 });
  assert.deepEqual(senderResult({ words: 6, reachedAt: 1200 }), { n: 6, t: 5000 });
  assert.equal(senderResult({ words: 4, reachedAt: 9000 }), null);
  assert.equal(senderResult({ words: 25 }), null);
  assert.equal(senderResult(null), null);
});

test('share text is spoiler-free', () => {
  assert.equal(shareText({ n: 25, t: 41200 }), 'TYPE A WORD · RACE · 25 WORDS IN 41.2s · BEAT ME →');
});

test('stash: save / read (re-filtered) / clear, and boot capture only on play=race', () => {
  const s = memStore();
  assert.equal(readChallenge(s), null);
  saveChallenge({ vs: 'xavi', t: 41200, n: 25 }, s);
  assert.deepEqual(readChallenge(s), { vs: 'XAVI', t: 41200, n: 25, opened: false });
  s.setItem(CHALLENGE_KEY, JSON.stringify({ vs: 'fuck', t: 1, n: 1000, opened: true }));
  assert.deepEqual(readChallenge(s), { vs: FALLBACK_NAME, t: 5000, n: 100, opened: true });
  s.setItem(CHALLENGE_KEY, '{not json');
  assert.equal(readChallenge(s), null);
  clearChallenge(s);
  assert.equal(s.getItem(CHALLENGE_KEY), null);

  const s2 = memStore();
  assert.equal(captureChallengeFromUrl('?race=1&vs=XAVI&t=41200&n=25', s2), null); // no play=race
  assert.equal(s2.getItem(CHALLENGE_KEY), null);
  assert.deepEqual(captureChallengeFromUrl('?vs=XAVI&t=41200&n=25&race=1&play=race', s2), { vs: 'XAVI', t: 41200, n: 25 });
  assert.deepEqual(readChallenge(s2), { vs: 'XAVI', t: 41200, n: 25, opened: false });
  // a plain /race/play (no challenge params) stashes nothing
  const s3 = memStore();
  assert.equal(captureChallengeFromUrl('?race=1&play=race', s3), null);
  assert.equal(s3.getItem(CHALLENGE_KEY), null);
});
