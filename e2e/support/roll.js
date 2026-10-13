// e2e/support/roll.js — TAP TO ROLL (Andy oct13; was HOLD TO ROLL, NIGHT oct8 R4): a press + release on ROLL is a roll,
// whatever its length (holdRoll keeps its old timing so every spec still drives a real pointer).
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
/** A quick tap — also a roll. */
export async function tapRoll(page, sel = '.rs-roll') {
  const box = await page.locator(sel).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
