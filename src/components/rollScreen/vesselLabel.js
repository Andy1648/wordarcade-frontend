// vesselLabel.js — PURE: the canister badge's tier word fitted INSIDE the painted plate's safe window (VesselArt).
// Bungee's metrics (measured: advance of the label at 1em, cap height 0.67em)
const BUNGEE_CAP = 0.67;
const ADVANCE = { 'EPIC+': 2.731, 'LEGENDARY+': 6.619 };
const MIN_SQUEEZE = 0.86;
/** The label fitted into the plate window ({x,y,w,h} % of the 512 canvas): { x, y (baseline), size, fit } in canvas px. */
export function fitLabel(text, plate, stroke = 0) {
  const W = (512 * plate.w) / 100 - stroke;
  const H = (512 * plate.h) / 100 - stroke;
  const adv = ADVANCE[text] || 0.68 * text.length;
  const size = Math.min((H * 0.8) / BUNGEE_CAP, W / (adv * MIN_SQUEEZE));
  const cx = (512 * (plate.x + plate.w / 2)) / 100;
  const cy = (512 * (plate.y + plate.h / 2)) / 100;
  return { x: +cx.toFixed(1), y: +(cy + (size * BUNGEE_CAP) / 2).toFixed(1), size: +size.toFixed(1), fit: +Math.min(W, adv * size).toFixed(1) };
}
