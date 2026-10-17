// reveal.js — THE UNLISTED GRANT + REVEAL, loaded lazily on a find (useWordSecrets imports it only when a secret fires,
// so none of this rides the menu's first load). Grants the gear (once — unlisted.js refuses an owned or out-of-season
// one), fires the stamp (revealBus → UnlistedStamp in the game's reaction slot) and asks the server for the serial (the
// stamp shows "#····" until it answers). The SEASON gear's word check (a real triple-double word) is judged here too.
import { grantUnlisted } from './unlisted.js';
import { emitReveal } from './revealBus.js';
import { claimSerial } from './serial.js';
import { isTripleDouble } from './seasonSecret.js';
import { TRIPLE_DOUBLE_ID } from './unlistedIds.js';

export function revealUnlisted(gearId, word) {
  if (gearId === TRIPLE_DOUBLE_ID && !isTripleDouble(word)) return null;
  let got = null;
  try { got = grantUnlisted(gearId, { word }); } catch { got = null; }
  if (!got) return null;
  emitReveal(got);
  claimSerial(gearId).catch(() => { /* stays pending */ });
  return got;
}
