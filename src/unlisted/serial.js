// serial.js — asks the server for an UNLISTED gear's serial ("#0042", supabase 052_unlisted.sql) and stores it.
// LAZY: imports the leaderboard client only when a find needs a number, so nothing here touches the menu's first load.
// A failure (offline, no profile yet, 052 not run) just leaves the serial pending ("#····"); retryPendingSerials()
// asks again on the next boot / index open. The server answers the SAME serial for a repeat claim, so a retry is safe.
import { pendingSerialIds, setUnlistedSerial, loadUnlisted } from './unlisted.js';
import { patchRevealSerial } from './revealBus.js';

let inflight = null;

/** One gear → its serial, stored. Resolves the number or null. Never throws. */
export async function claimSerial(gearId, { client } = {}) {
  try {
    const c = client || (await import('../leaderboard/client.js'));
    if (!c.LEADERBOARD_ENABLED && !client) return null;
    const secret = c.getSecret();
    if (!secret) return null;
    const r = await c.rpc('lb_unlisted_claim', { p_secret: secret, p_gear: gearId });
    if (r && r.ok) {
      const n = setUnlistedSerial(gearId, r.serial);
      if (n != null) patchRevealSerial(gearId, n);
      return n;
    }
  } catch {
    /* offline / 052 not run — stays pending */
  }
  return null;
}

/** Every owned gear still without a serial, one after another (the claim allows one per 2 s). */
export function retryPendingSerials({ client, gapMs = 2100 } = {}) {
  if (inflight) return inflight;
  const ids = pendingSerialIds();
  if (!ids.length) return Promise.resolve([]);
  // oldest find first, so two finds keep their order
  const { owned } = loadUnlisted();
  ids.sort((a, b) => (owned[a].at || 0) - (owned[b].at || 0));
  inflight = (async () => {
    const got = [];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) await new Promise((res) => setTimeout(res, gapMs));
      got.push(await claimSerial(ids[i], { client }));
    }
    return got;
  })().finally(() => { inflight = null; });
  return inflight;
}
