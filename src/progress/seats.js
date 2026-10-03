// seats.js — H4 anti-farm: which player ids are held by OTHER TABS OF THIS BROWSER.
//
// The cheapest way to farm a "beat a human" bonus is two tabs of the same browser in one room:
// tab B sits there (or types three words) and tab A collects the win. Both tabs share one
// localStorage, so each tab writes its live player id into one map keyed by a per-tab id, and at
// game over any rival id another tab registered is the player themself — never a rival.
// (A second browser profile is a separate wallet; that case is bounded by the contest + pace caps
// in payout.js winnerPayout, see claude/finetune/h4-winner-spec.md.)
//
// Never throws: blocked or corrupt storage simply reports no other seats (fails OPEN to the
// honest case — the caps still bound the bonus).
export const SEATS_KEY = 'taw.seats';
export const SEAT_TTL_MS = 3 * 60 * 60 * 1000; // a tab that has not reconnected in 3h is gone

function read(storage) {
  try {
    const raw = storage && storage.getItem(SEATS_KEY);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function makeSeats({ storage, tabId }) {
  return {
    /** Record this tab's current player id (call on every fresh connection id). */
    note(playerId, now = Date.now()) {
      if (!storage || playerId == null) return;
      try {
        const all = read(storage);
        for (const k of Object.keys(all)) {
          if (!all[k] || !(now - all[k].at < SEAT_TTL_MS)) delete all[k];
        }
        all[tabId] = { id: playerId, at: now };
        storage.setItem(SEATS_KEY, JSON.stringify(all));
      } catch {
        /* storage blocked: no seat recorded */
      }
    },
    /** Player ids held by OTHER live tabs of this browser. */
    otherIds(now = Date.now()) {
      const all = read(storage);
      return Object.keys(all)
        .filter((k) => k !== tabId && all[k] && now - all[k].at < SEAT_TTL_MS && all[k].id != null)
        .map((k) => all[k].id);
    },
  };
}

// The app's instance: one random id per tab (per page load — a duplicated tab gets its own).
function browserStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
const appSeats = makeSeats({ storage: browserStorage(), tabId: Math.random().toString(36).slice(2, 10) });
export const noteSeat = (id) => appSeats.note(id);
export const otherSeatIds = () => appSeats.otherIds();
