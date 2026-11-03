// rejectLog.js — THE REJECT LOG (Andy nov4: "they need more … accepted words"): which REAL-LOOKING words the solo modes
// reject as "not in our word list", so the accept lists can grow from evidence instead of guesses. Anonymous by design:
// only the word and the mode go out — no player id, no name, no session, no timestamp beyond the server's day bucket.
// Tiny and polite: deduped per mode, batched (one call per BATCH_MS, at most BATCH_MAX words), at most MAX_FLUSHES calls
// a page session, a–z words of 2–15 letters only. Fire-and-forget: a failure is dropped, never retried, never shown.
// Server side: supabase/migrations/082_reject_log.sql (log_rejects RPC — capped again there).

export const REJECT_MODES = ['fuse', 'chain'];
export const BATCH_MS = 60 * 1000;
export const BATCH_MAX = 20;
export const MAX_FLUSHES = 5;
const WORD_RE = /^[a-z]{2,15}$/;

/**
 * A reject log over an injected `send(mode, words)` (returns a promise) and timer — the live one is `noteReject` below.
 * PURE of I/O itself, so the unit test drives it with a fake sender and fake timers.
 */
export function createRejectLog({ send, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const queue = new Map(); // mode → Set(word)
  const sent = new Set(); // `${mode}:${word}` already sent this session — never twice
  let timer = null;
  let flushes = 0;

  function flush() {
    timer = null;
    for (const [mode, words] of queue) {
      if (flushes >= MAX_FLUSHES) break;
      const batch = [...words].slice(0, BATCH_MAX);
      if (!batch.length) continue;
      for (const w of batch) { words.delete(w); sent.add(`${mode}:${w}`); }
      flushes += 1;
      try { Promise.resolve(send(mode, batch)).catch(() => {}); } catch { /* dropped */ }
    }
    const left = [...queue.values()].some((s) => s.size > 0);
    if (left && flushes < MAX_FLUSHES) timer = setTimer(flush, BATCH_MS);
  }

  return {
    /** Queue one rejected word. Returns true when it was queued (valid, new, under the caps). */
    note(word, mode) {
      const w = String(word || '').trim().toLowerCase();
      if (!REJECT_MODES.includes(mode) || !WORD_RE.test(w) || flushes >= MAX_FLUSHES) return false;
      if (sent.has(`${mode}:${w}`)) return false;
      if (!queue.has(mode)) queue.set(mode, new Set());
      const q = queue.get(mode);
      if (q.has(w) || q.size >= BATCH_MAX * MAX_FLUSHES) return false;
      q.add(w);
      if (!timer) timer = setTimer(flush, BATCH_MS);
      return true;
    },
    /** Send what is queued now (page hide / run end). */
    flush() {
      if (timer) { clearTimer(timer); timer = null; }
      flush();
    },
    stats: () => ({ flushes, queued: [...queue.values()].reduce((n, s) => n + s.size, 0) }),
  };
}

// The live log: sends through the leaderboard client's RPC (lazy — it is already loaded by the menu), only when the
// board is configured. Flushed early when the page is hidden, so a closed tab still reports its batch.
let live = null;
function liveLog() {
  if (live) return live;
  live = createRejectLog({
    send: (mode, words) => import('../leaderboard/client.js').then((m) => (m.LEADERBOARD_ENABLED ? m.rpc('log_rejects', { p_mode: mode, p_words: words }) : null)),
  });
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('pagehide', () => live.flush());
  return live;
}

/** A solo mode rejected `word` as not in the list. */
export function noteReject(word, mode) {
  try { return liveLog().note(word, mode); } catch { return false; }
}
