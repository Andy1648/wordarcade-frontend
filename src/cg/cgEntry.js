// cgEntry.js
// CrazyGames zero-click direct entry (?cg=1). Pure, side-effect-free helpers so
// the flag parsing and the arm-state gate can be unit-tested with node:test
// without a live socket or a DOM. The only window reads are the module-load
// snapshot (CG_ENTRY) and isCoarsePointer(), both guarded for the node runtime.
//
// The whole feature is gated behind CG_ENTRY: with no ?cg=1 flag every export
// here evaluates to "off", so the default (no-flag) entry path is unchanged.

/**
 * True when the location search carries the CrazyGames direct-entry flag
 * (?cg=1). Injectable (takes the raw `search` string) so it's pure + testable.
 * Malformed input can never throw — a bad query just reads as "not cg".
 */
export function parseCgFlag(search) {
  try {
    return new URLSearchParams(search || '').get('cg') === '1';
  } catch {
    return false;
  }
}

// Module-load snapshot of the flag, mirroring App.jsx's PORTAL_SKIP_INTRO /
// LAUNCH_INTENT pattern (read once, at import). false under node (no window).
export const CG_ENTRY =
  typeof window !== 'undefined' && parseCgFlag(window.location.search);

/**
 * The cg room is "provisioned" once our programmatic create_room + add_bot have
 * landed: the roster carries at least the human + the bot (2 seats). Until then
 * we have no host-side room to start, so start_game must wait.
 */
export function cgRoomReady(room) {
  return !!room && Array.isArray(room.players) && room.players.length >= 2;
}

/**
 * The arm-state gate: start_game may fire ONLY when the socket is open AND the
 * solo room+bot are provisioned. Pure (booleans in) so the exact condition that
 * releases the round is unit-testable without a socket.
 */
export function cgCanArm({ wsOpen, roomReady }) {
  return !!wsOpen && !!roomReady;
}

/**
 * Whether a keydown is an "accepted keystroke" that arms the round. Only a bare
 * single letter counts — modifiers, space, Enter, Backspace, Tab, arrows, etc.
 * never arm (they aren't the start of a word). The discarded arming key is what
 * lets us clear the input before the real combo renders.
 */
export function isArmingKey(key) {
  return typeof key === 'string' && /^[a-zA-Z]$/.test(key);
}

/**
 * Coarse pointer = touch: mobile gets the 56px TAP TO START button; a fine
 * pointer autofocuses the input on mount instead. Guarded for node/jsdom.
 */
export function isCoarsePointer() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}
