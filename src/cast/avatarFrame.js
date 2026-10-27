// avatarFrame.js — the ROUND AVATAR FRAMES (oct26, Andy: "the worn frame goes round the hero portrait wherever it
// shows"). Each card FRAME (kit.js FRAMES) has a matching painted ring, /cast/avatar/<id>.webp (256px, ChatGPT, the card
// frame as the reference). Kept free of kit.js / cast.js so the menu's profile plate can wear it on first paint (payload
// ratchet): the worn id is read straight from storage and shape-checked against this table, like mainFace.js.
// WIN = the face window in the ring image, % of its box: [centre x, centre y, radius] (measured off each ring's hole).
export const AVATAR_WIN = {
  frost: [49.8, 47.1, 32.4], graffiti: [50.0, 49.6, 31.6], flame: [50.0, 52.7, 37.1], arcade: [49.8, 52.5, 31.2],
  bomb: [50.0, 57.0, 33.4], bolt: [49.8, 52.3, 36.4], scholar: [50.0, 49.2, 33.4], chain: [50.0, 52.9, 33.9],
  defuser: [50.0, 54.7, 33.6], jackpot: [50.0, 51.8, 36.2],
};
/** kit.js writeKit fires this so every worn-frame portrait swaps the moment you equip. */
export const KIT_CHANGE = 'taw:kit-change';
const KIT_KEY = 'taw.s2.kit'; // = kit.js KIT_KEY

/** The frame you wear, if it has a ring (null = none). */
export function wornAvatarFrame() {
  try {
    const v = JSON.parse(localStorage.getItem(KIT_KEY) || '{}');
    const id = v && v.frame;
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(AVATAR_WIN, id) ? id : null;
  } catch { return null; }
}
