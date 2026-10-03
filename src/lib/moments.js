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

export const GAP_MS = 220;
export const DEFAULT_MAX_MS = 6000;

export const PRIORITY = { TUTORIAL: 0, INFO: 1, REWARD: 2, LEVEL: 3, WIN: 4 };

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
    const item = queue.shift();
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
    current = { id: item.id, priority: item.priority, startedAt: now(), release, timer: null };
    current.timer = setTimer(release, item.maxMs);
    emit();
    try {
      item.start(release);
    } catch {
      release();
    }
  }

  return {
    /** Queue a moment. start(done) runs when it is its turn; call done() when it has finished playing.
     *  Returns a cancel() that drops it if it has not started (or ends it if it has). */
    announce({ id, start, priority = PRIORITY.INFO, maxMs = DEFAULT_MAX_MS }) {
      const key = id || `m${++seq}`;
      if ((current && current.id === key) || queue.some((q) => q.id === key)) return () => {};
      const item = { id: key, start, priority, maxMs, n: ++seq };
      let at = queue.findIndex((q) => q.priority < priority);
      if (at < 0) at = queue.length;
      queue.splice(at, 0, item);
      emit();
      pump();
      return () => {
        const i = queue.indexOf(item);
        if (i >= 0) { queue.splice(i, 1); emit(); return; }
        if (current && current.id === key) current.release();
      };
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
