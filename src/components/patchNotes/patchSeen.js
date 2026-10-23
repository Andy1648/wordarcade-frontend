// patchSeen.js — the menu's ONLY eager piece of the patch notes (payload ratchet): which release, and has this browser
// seen it. Everything else (the host, the popup, the copy) is lazy. Bump PATCH_ID to show the notes once more.
export const PATCH_ID = '2026-10-22';
export const PATCH_SEEN_KEY = 'taw.seen.patch'; // taw.seen* survives the season wipe (season2Boot KEEP_PREFIXES)

export function patchSeen(storage = globalThis.localStorage) {
  try { return storage.getItem(PATCH_SEEN_KEY) === PATCH_ID; } catch { return true; } // blocked storage: never nag
}
export function markPatchSeen(storage = globalThis.localStorage) {
  try { storage.setItem(PATCH_SEEN_KEY, PATCH_ID); } catch { /* blocked */ }
}
