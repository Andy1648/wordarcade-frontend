// node --test — CrazyGames direct-entry (?cg=1) flag parsing + the arm-state
// gate. Pure logic only (no DOM/socket), matching the module's design.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCgFlag,
  cgRoomReady,
  cgCanArm,
  isArmingKey,
} from './cgEntry.js';

test('parseCgFlag: only ?cg=1 turns the entry on', () => {
  assert.equal(parseCgFlag('?cg=1'), true);
  assert.equal(parseCgFlag('cg=1'), true); // leading ? optional
  assert.equal(parseCgFlag('?foo=bar&cg=1'), true);
  assert.equal(parseCgFlag('?cg=0'), false);
  assert.equal(parseCgFlag('?cg=true'), false); // strict "1" only
  assert.equal(parseCgFlag('?portal=1'), false);
  assert.equal(parseCgFlag(''), false);
  assert.equal(parseCgFlag(undefined), false);
  assert.equal(parseCgFlag(null), false);
});

test('parseCgFlag: never throws on malformed input', () => {
  assert.equal(parseCgFlag('%'), false); // would throw un-guarded
  assert.equal(parseCgFlag('?=&&=='), false);
});

test('cgRoomReady: true once the human + bot are both seated', () => {
  assert.equal(cgRoomReady(null), false);
  assert.equal(cgRoomReady(undefined), false);
  assert.equal(cgRoomReady({}), false); // no players array
  assert.equal(cgRoomReady({ players: [] }), false);
  assert.equal(cgRoomReady({ players: [{ id: 'me' }] }), false); // human only, bot not added yet
  assert.equal(cgRoomReady({ players: [{ id: 'me' }, { id: 'bot' }] }), true);
});

test('cgCanArm: needs BOTH an open socket and a provisioned room', () => {
  assert.equal(cgCanArm({ wsOpen: true, roomReady: true }), true);
  assert.equal(cgCanArm({ wsOpen: false, roomReady: true }), false);
  assert.equal(cgCanArm({ wsOpen: true, roomReady: false }), false);
  assert.equal(cgCanArm({ wsOpen: false, roomReady: false }), false);
});

test('isArmingKey: only a bare single letter arms the round', () => {
  assert.equal(isArmingKey('a'), true);
  assert.equal(isArmingKey('Z'), true);
  // Non-arming keys: the round must not start on these.
  assert.equal(isArmingKey(' '), false); // space
  assert.equal(isArmingKey('Enter'), false);
  assert.equal(isArmingKey('Backspace'), false);
  assert.equal(isArmingKey('Tab'), false);
  assert.equal(isArmingKey('Shift'), false);
  assert.equal(isArmingKey('ArrowLeft'), false);
  assert.equal(isArmingKey('1'), false); // digit
  assert.equal(isArmingKey('!'), false);
  assert.equal(isArmingKey(''), false);
  assert.equal(isArmingKey(undefined), false);
});
