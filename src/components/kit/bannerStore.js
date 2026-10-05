// kit/bannerStore.js — the TOP BANNER queue (KitCurrency sheet, "FROM THE TOP · NEVER CENTER").
//
// "STACKS 3 DEEP · 4S EACH · TAP A BANNER TO CLOSE": pushBanner() adds one at the top of the stack;
// a fourth closes the oldest; each closes itself after BANNER_MS; closeBanner() (a tap) closes early.
// A closing banner stays in the list for BANNER_LEAVE_MS with `leaving: true` so its exit can play.
// Pure apart from the injected timers; one store per app (the default) or one per host (tests).

export const BANNER_MS = 4000;
export const BANNER_LEAVE_MS = 270;
export const BANNER_MAX = 3;

export function createBannerStore({ setTimer = setTimeout, clearTimer = clearTimeout, lifeMs = BANNER_MS, leaveMs = BANNER_LEAVE_MS, max = BANNER_MAX } = {}) {
  let list = []; // { id, leaving, ...payload }, oldest first
  let seq = 0;
  const timers = new Map();
  const subs = new Set();
  const emit = () => {
    for (const fn of [...subs]) {
      try { fn(); } catch { /* listener */ }
    }
  };
  const set = (next) => {
    list = next;
    emit();
  };

  function close(id) {
    const b = list.find((x) => x.id === id);
    if (!b || b.leaving) return false;
    const t = timers.get(id);
    if (t) clearTimer(t);
    set(list.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    timers.set(id, setTimer(() => {
      timers.delete(id);
      set(list.filter((x) => x.id !== id));
    }, leaveMs));
    return true;
  }

  return {
    push(payload) {
      seq += 1;
      const id = seq;
      const live = list.filter((x) => !x.leaving);
      if (live.length >= max) close(live[0].id);
      set([...list, { ...payload, id, leaving: false }]);
      timers.set(id, setTimer(() => close(id), lifeMs));
      return id;
    },
    close,
    clear() {
      for (const t of timers.values()) clearTimer(t);
      timers.clear();
      set([]);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    getSnapshot() {
      return list;
    },
  };
}

/** The app's one banner stack. */
export const banners = createBannerStore();
export const pushBanner = (b) => banners.push(b);
export const closeBanner = (id) => banners.close(id);
