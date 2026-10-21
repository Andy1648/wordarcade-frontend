// labelSize.js — the KitButton / KitHoldButton label classes. Only four sizes are drawn (kb-fs24/30/34/38); a size in
// between used to fall straight through to the BIGGEST (38 — PatchNotes passed 32 and its COLLECTING overflowed the
// face). An unknown size now takes the nearest drawn size AT OR BELOW it, so a label can only ever come out smaller
// than asked, never bigger.
export const LABEL_SIZES = [24, 30, 34, 38];

export function labelClass(size, fallback = 38) {
  const n = Number(size);
  if (!Number.isFinite(n)) return `kb-fs${fallback}`;
  let pick = LABEL_SIZES[0];
  for (const s of LABEL_SIZES) if (s <= n) pick = s;
  return `kb-fs${pick}`;
}
