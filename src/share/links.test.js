// node --test — invite/daily deep-link builders (Feature: frictionless invite).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inviteLink, dailyLink } from './links.js';
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
