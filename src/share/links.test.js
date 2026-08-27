// node --test — invite/daily deep-link builders (Feature: frictionless invite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inviteLink, dailyLink, satRushLink, chainLink, fuseLink, modeShareLink } from './links.js';
import { REF_URL } from './shareConfig.js';

test('inviteLink builds the ?join deep link on the given origin', () => {
  assert.equal(
    inviteLink('QX7ZP', 'https://typeaword.com'),
    'https://typeaword.com/?join=QX7ZP&ref=share'
  );
});

test('inviteLink works for localhost origins (dev demo)', () => {
  assert.equal(
    inviteLink('AB2CD', 'http://localhost:5173'),
    'http://localhost:5173/?join=AB2CD&ref=share'
  );
});

test('inviteLink URL-encodes whatever it is given', () => {
  assert.equal(
    inviteLink('A&B=C', 'https://typeaword.com'),
    'https://typeaword.com/?join=A%26B%3DC&ref=share'
  );
});

test('inviteLink without a code falls back to the plain ref URL', () => {
  assert.equal(inviteLink('', 'https://typeaword.com'), REF_URL);
  assert.equal(inviteLink(null, 'https://typeaword.com'), REF_URL);
});

test('inviteLink outside a browser falls back to the production origin', () => {
  assert.equal(inviteLink('QX7ZP'), 'https://typeaword.com/?join=QX7ZP&ref=share');
});

test('dailyLink deep-links straight into the daily', () => {
  assert.equal(dailyLink('https://typeaword.com'), 'https://typeaword.com/?daily=1&ref=share');
  assert.equal(dailyLink(), 'https://typeaword.com/?daily=1&ref=share');
});

test('satRushLink deep-links straight into SAT Rush', () => {
  assert.equal(satRushLink('https://typeaword.com'), 'https://typeaword.com/?satrush=1&ref=share');
  assert.equal(satRushLink(), 'https://typeaword.com/?satrush=1&ref=share');
});

test('chain/fuse links deep-link straight into their mode', () => {
  assert.equal(chainLink('https://typeaword.com'), 'https://typeaword.com/?chain=1&ref=share');
  assert.equal(fuseLink('https://typeaword.com'), 'https://typeaword.com/?fuse=1&ref=share');
});

test('modeShareLink routes each mode to a working deep link (word-bomb -> menu)', () => {
  const o = 'https://typeaword.com';
  assert.equal(modeShareLink('fuse', o), 'https://typeaword.com/?fuse=1&ref=share');
  assert.equal(modeShareLink('chain', o), 'https://typeaword.com/?chain=1&ref=share');
  assert.equal(modeShareLink('sat-rush', o), 'https://typeaword.com/?satrush=1&ref=share');
  assert.equal(modeShareLink('category-blitz', o), 'https://typeaword.com/?daily=1&ref=share');
  // word-bomb has no solo deep-link param -> mode-select homepage (documented gap).
  assert.equal(modeShareLink('word-bomb', o), 'https://typeaword.com/?ref=share');
  assert.equal(modeShareLink('anything-else', o), 'https://typeaword.com/?ref=share');
});
