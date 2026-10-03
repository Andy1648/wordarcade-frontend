// moments.js — H5 (Andy oct3 02:24): "important = announced: one shared popup component with a queue", and
// H3: "queued (never two heavy at once)". The ONE queue every big menu moment goes through — level-up / tier-up,
// rank-up, the new wall, unlock tutorials, claims, purchases, rebirth, code redeem, a multiplayer WIN.
//
// It owns ORDER, never the art: a moment asks for a slot with announce({ id, start }); when its turn comes the
// queue calls start(done) and the moment plays however it already plays, calling done() when it ends. So the
// existing moments adopt it without being rewritten, and nothing can paint two heavy moments at once.
//
// Rules: one heavy moment at a time; a short GAP between them; higher priority jumps the queue (FIFO within a
// priority); the same id is never queued twice; a moment that never calls done() is released after its
// maxMs (a lost callback can never jam the queue); while the page is BUSY (a panel open, a game running —
// setBusy) nothing new starts. No timers run while the queue is empty.
// A LINGERING moment (the claim popup: up to 8 s, tucked by a key/tap) is announced `interruptible`: when a
// HIGHER-priority moment is announced while it plays, the queue releases it at once and calls its
// onInterrupt() (hide, and re-announce to come back after) — a waiting reward never delays a level/wall/rank.

// ≥250ms between two heavy moments (next-passes-spec PASS 2: "one at a time, ≥250ms gap").
export const GAP_MS = 250;
export const DEFAULT_MAX_MS = 6000;

export const PRIORITY = { TUTORIAL: 0, INFO: 1, REWARD: 2, LEVEL: 3, WIN: 4 };
// IN-GAME heavy moments (feel ladder, PASS 2 §2.3): FRENZY start > CLUTCH burst > FRENZY/BOOST OVER >
// BOOST start, on the same numeric scale so a game moment and a menu moment can never paint together.
export const GAME_PRIORITY = { BOOST_START: 1, TIMER_OVER: 2, CLUTCH: 3, FRENZY_START: 4 };

export function createMoments({ setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now() } = {}) {
  const queue = [];
  let current = null; // { id, priority, maxMs, startedAt, release }
  let busy = 0;
  let gapUntil = 0;
  let wake = null;
  let seq = 0;
  const listeners = new Set();

  const emit = () => { for (const fn of listeners) { try { fn(snapshot()); } catch { /* listener */ } } };
  const snapshot = () => ({ current: current && current.id, queued: queue.map((q) => q.id), busy: busy > 0 });

  function schedule(ms) {
    if (wake) clearTimer(wake);
    wake = setTimer(() => { wake = null; pump(); }, Math.max(0, ms));
  }

  function pump() {
    if (current || busy > 0 || !queue.length) return;
    const wait = gapUntil - now();
    if (wait > 0) { schedule(wait); return; }
    // A moment that waited past its expireMs is STALE (an in-game CLUTCH that only gets its turn
    // seconds later would celebrate a word nobody remembers): drop it unplayed, never late.
    let item = queue.shift();
    while (item && item.expireMs > 0 && now() - item.queuedAt > item.expireMs) {
      try { if (item.onExpire) item.onExpire(); } catch { /* listener */ }
      item = queue.shift();
    }
    if (!item) { emit(); return; }
    let finished = false;
    const release = () => {
      if (finished) return;
      finished = true;
      if (current && current.timer) clearTimer(current.timer);
      current = null;
      gapUntil = now() + GAP_MS;
      emit();
      if (queue.length) schedule(GAP_MS);
    };
    current = { id: item.id, priority: item.priority, startedAt: now(), release, timer: null, item };
    current.timer = setTimer(release, item.maxMs);
    emit();
    try {
      item.start(release);
    } catch {
      release();
    }
  }

  function cancelFor(item, key) {
    return () => {
      const i = queue.indexOf(item);
      if (i >= 0) { queue.splice(i, 1); emit(); return; }
      if (current && current.id === key && current.item === item) current.release();
    };
  }

  return {
    /** Queue a moment. start(done) runs when it is its turn; call done() when it has finished playing.
     *  Returns a cancel() that drops it if it has not started (or ends it if it has). */
    announce({ id, start, priority = PRIORITY.INFO, maxMs = DEFAULT_MAX_MS, expireMs = 0, onExpire = null, interruptible = false, onInterrupt = null }) {
      const key = id || `m${++seq}`;
      if ((current && current.id === key) || queue.some((q) => q.id === key)) return () => {};
      const item = { id: key, start, priority, maxMs, expireMs, onExpire, interruptible, onInterrupt, queuedAt: now(), n: ++seq };
      let at = queue.findIndex((q) => q.priority < priority);
      if (at < 0) at = queue.length;
      queue.splice(at, 0, item);
      emit();
      // a lingering (interruptible) moment steps aside for a higher-priority one
      if (current && current.item.interruptible && priority > current.priority) {
        const was = current.item;
        current.release();
        try { if (was.onInterrupt) was.onInterrupt(); } catch { /* listener */ }
        return cancelFor(item, key);
      }
      pump();
      return cancelFor(item, key);
    },
    /** A panel / game holds the queue while it is up. Counted, so nested holds are safe. Returns unhold(). */
    hold() {
      busy += 1;
      emit();
      let held = true;
      return () => {
        if (!held) return;
        held = false;
        busy = Math.max(0, busy - 1);
        emit();
        pump();
      };
    },
    isPlaying: () => !!current,
    snapshot,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Drop everything queued (leaving the menu for a game, a reset). The current moment finishes. */
    clear() { queue.length = 0; emit(); },
  };
}

// The app-wide queue.
export const moments = createMoments();
