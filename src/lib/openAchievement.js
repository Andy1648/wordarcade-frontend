// openAchievement.js — "take me to that achievement" (Andy oct17: the gears requiring an achievement take you to it).
// A window event so the gear sheet (deep inside the ROLL / INDEX / EQUIP layers) needs no prop threaded up: the menu
// closes its gear layer, and the ACHIEVEMENTS button (S2Trophy) opens its screen on that ladder. Cancelable: the
// first trophy that handles it calls preventDefault, so the menu's two trees never open two screens.
export const OPEN_ACH_EVENT = 'taw:open-achievement';
export function openAchievement(id) {
  try {
    window.dispatchEvent(new CustomEvent(OPEN_ACH_EVENT, { detail: { id }, cancelable: true }));
  } catch {
    /* no window */
  }
}
