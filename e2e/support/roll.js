// e2e/support/roll.js — HOLD TO ROLL (NIGHT oct8 R4): the ROLL slab is HELD for CHARGE_MS, then RELEASED — the release
// is the spin (RollScreen.jsx / reelPlan.CHARGE_MS). A plain click is a hold released early = a cancel, nothing paid.
// Raw mouse events on ROLL's centre (not locator.click(): a reveal on top of ROLL would make click() wait forever —
// a real thumb lands on whatever is on top, see roll-robust).
export const CHARGE_MS = 500;
export const HOLD_MS = CHARGE_MS + 140; // a hair past full charge: the release fires the spin

export async function holdRoll(page, sel = '.rs-roll', { ms = HOLD_MS } = {}) {
  const box = await page.locator(sel).boundingBox();
  if (!box) throw new Error(`holdRoll: ${sel} has no box`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
/** A tap that is NOT a roll (released long before the charge). */
export async function tapRoll(page, sel = '.rs-roll') {
  const box = await page.locator(sel).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
