// leaguePlate.js — where each league badge's NAME-PLATE TAB sits (RankSeal prints the place there). Pure, so the tests can
// read it. Fractions of the art's square, measured off the cut: x / y = the tab's centre, w = its width. v3 (nov12): the
// badge centre is the league's EMBLEM (skull, blade, die, wolf, eye, oni, phoenix, dragon) so each reads by silhouette at
// 24–32 px; the place moved to the empty tab at the bottom edge.
export const LEAGUE_PLATE = {
  bronze: { x: 0.5, y: 0.864, w: 0.312 },
  silver: { x: 0.506, y: 0.833, w: 0.35 },
  gold: { x: 0.492, y: 0.858, w: 0.359 },
  crystal: { x: 0.5, y: 0.859, w: 0.344 },
  master: { x: 0.498, y: 0.878, w: 0.341 },
  titan: { x: 0.502, y: 0.884, w: 0.341 },
  champion: { x: 0.497, y: 0.873, w: 0.356 },
  legend: { x: 0.498, y: 0.872, w: 0.372 },
};
