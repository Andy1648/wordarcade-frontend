// reveal.js — THE UNLISTED GRANT + REVEAL, loaded lazily on a find (acceptedWords.js imports it only when a find fires,
// so none of this rides the menu's first load). Grants the gear (once — unlisted.js refuses an owned or out-of-season
// one), fires the stamp (revealBus → UnlistedStamp in the mode's reaction slot) and asks the server for the serial (the
// stamp shows "#····" until it answers). What counts as a find is judged in acceptedWords.js (an ACCEPTED word).
import { grantUnlisted } from './unlisted.js';
import { emitReveal } from './revealBus.js';
import { claimSerial } from './serial.js';

export function revealUnlisted(gearId, word) {
  let got = null;
  try { got = grantUnlisted(gearId, { word }); } catch { got = null; }
  if (!got) return null;
  emitReveal(got);
  claimSerial(gearId).catch(() => { /* stays pending */ });
  return got;
}
