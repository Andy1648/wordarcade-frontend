// leaguePlate.js — the league badges' plates (RankSeal prints a place on them). Pure, so the tests can read it.
// Where each badge's plate sits, as fractions of the art's square (measured off the cut): x / y centre, w = plate width.
// The number is printed there; a badge whose plate is small (the ornate top leagues) is drawn bigger to keep it readable.
export const LEAGUE_PLATE = {
  legend: { x: 0.497, y: 0.511, w: 0.281 },
  champion: { x: 0.498, y: 0.534, w: 0.322 },
  titan: { x: 0.5, y: 0.486, w: 0.331 },
  master: { x: 0.498, y: 0.475, w: 0.328 },
  crystal: { x: 0.497, y: 0.472, w: 0.331 },
  gold: { x: 0.497, y: 0.459, w: 0.381 },
  silver: { x: 0.494, y: 0.463, w: 0.444 },
  bronze: { x: 0.498, y: 0.425, w: 0.484 },
};
