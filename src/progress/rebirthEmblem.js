// rebirthEmblem.js — THE REBIRTH EMBLEM (nov2, design audit #12 "REBIRTH has no prestige object"): a painted hexagon
// badge (public/rebirth/emblem-N-v1.webp) that climbs a band every JACKPOT rebirth — R5, R10, R15, R20:
// bronze → silver → gold → crystal → mythic. A leaf: no imports, so the rebirth screen and any later surface share it.
export const EMBLEM_BANDS = [0, 5, 10, 15, 20];
/** The band (1–5) a rebirth count wears. */
export const emblemBand = (r) => EMBLEM_BANDS.filter((b) => (Number(r) || 0) >= b).length;
/** Its painted emblem. */
export const emblemSrc = (r) => `/rebirth/emblem-${emblemBand(r)}-v1.webp`;
