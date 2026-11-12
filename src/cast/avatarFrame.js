// avatarFrame.js — the SQUARE AVATAR FRAMES (nov2, Andy: "the avatar frames should be more square"; were round rings
// oct26). Each card FRAME (kit.js FRAMES) has a matching painted rounded-square frame, /cast/avatar/<id>-sq-v1.webp
// (256px, ChatGPT, one chat for the set) — the same shape as the LB row heads and podium faces. The tiers differ in
// STRUCTURE, not just colour: plain band (frost / graffiti / flame) < band + corner brackets (bomb / bolt / scholar /
// chain / defuser) < the art breaks the frame (arcade, jackpot). Kept free of kit.js / cast.js so the menu's profile
// plate can wear it on first paint (payload ratchet): the worn id is read straight from storage and shape-checked
// against this table, like mainFace.js.
// WIN = the face window in the frame image, % of its box: [centre x, centre y, half side] (measured off each cut's hole).
export const AVATAR_WIN = {
  frost: [49.41, 47.46, 32.29], graffiti: [51.06, 45.04, 29.27], flame: [49.82, 50.53, 32.6], arcade: [48.98, 51.37, 28.67],
  bomb: [46.38, 57.88, 26.93], bolt: [49.58, 49.75, 28.29], scholar: [47.07, 48.16, 28.68], chain: [47.8, 45.02, 31.08],
  defuser: [50.17, 50.51, 28.36], jackpot: [48.19, 52.21, 22.79],
};
/** The painted frame for a frame id (immutable art: a repaint ships a new -vN name). */
export const avatarFrameSrc = (id) => `/cast/avatar/${id}-sq-v1.webp`;
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
