// raceState.js — WORD RACE client state, as a PURE reducer over the server's race_* frames.
//
// The server is the only source of truth for the sequence, progress and the winner; this reducer
// only mirrors what it was told, in arrival order (App dispatches every drained frame — the same
// FIFO the rest of the app relies on, so two frames in one tick are both applied). Clock: every
// timed frame carries `serverNow`; the reducer keeps `offset = serverNow - localNow` so goAt /
// endsAt convert to the local clock and a countdown reads right on a device whose clock is off.
//
// Action shape: { frame: { type, payload }, now } — `now` is the local Date.now() at receipt,
// passed in so the reducer stays pure and testable.

export const RACE_REASON_COPY = {
  too_short: 'TOO SHORT — 3+ LETTERS',
  missing_combo: 'MISSING THE LETTERS',
  already_used: 'YOU ALREADY USED THAT',
  not_a_word: 'NOT IN THE DICTIONARY',
  race_not_live: 'RACE IS NOT LIVE',
  not_a_racer: "YOU'RE NOT IN THIS RACE",
};

export const EMPTY_RACE = null;

function toLocal(serverMs, offset) {
  return Number.isFinite(serverMs) ? serverMs - offset : null;
}

function offsetOf(payload, now, prev) {
  return Number.isFinite(payload?.serverNow) ? payload.serverNow - now : prev || 0;
}

export function raceReducer(state, action) {
  if (!action) return state;
  if (action.type === 'reset') return EMPTY_RACE;
  if (action.type === 'local') return localResult(state, action.result);
  const { frame, now = Date.now() } = action;
  if (!frame || typeof frame.type !== 'string') return state;
  const p = frame.payload || {};

  switch (frame.type) {
    case 'race_queue': {
      const offset = offsetOf(p, now, state?.offset);
      return {
        ...(state && state.status === 'queue' ? state : {}),
        status: 'queue',
        code: p.code,
        humans: p.humans || 1,
        maxRacers: p.maxRacers || 5,
        fillAt: now + (Number(p.fillInMs) || 0),
        offset,
      };
    }
    case 'race_start': {
      const offset = offsetOf(p, now, 0);
      return {
        status: 'countdown',
        seed: p.seed,
        fragments: Array.isArray(p.fragments) ? p.fragments : [],
        tiers: Array.isArray(p.tiers) ? p.tiers : [],
        target: p.target || 12,
        capMs: p.capMs || 90000,
        racers: (p.racers || []).map((r) => ({
          id: r.id,
          name: r.name,
          isBot: !!r.isBot,
          index: 0,
          lastWord: '',
          left: false,
        })),
        offset,
        goAt: toLocal(p.goAt, offset),
        endsAt: null,
        lastResult: null,
        resultSeq: 0,
        myWords: [], // MY accepted words (race_word_result only ever reaches its submitter)
        over: null,
      };
    }
    case 'race_go': {
      if (!state) return state;
      const offset = offsetOf(p, now, state.offset);
      return {
        ...state,
        status: state.status === 'over' ? 'over' : 'racing',
        offset,
        goAt: toLocal(p.goAt, offset),
        endsAt: toLocal(p.endsAt, offset),
      };
    }
    case 'race_progress': {
      if (!state || !state.racers) return state;
      return {
        ...state,
        racers: state.racers.map((r) =>
          r.id === p.racerId ? { ...r, index: Math.max(r.index, p.index || 0), lastWord: p.word || r.lastWord } : r,
        ),
      };
    }
    case 'race_word_result': {
      if (!state) return state;
      return {
        ...state,
        lastResult: {
          accepted: !!p.accepted,
          word: p.word || '',
          reason: p.reason || null,
          fragment: p.fragment || null,
          index: p.index,
          local: false,
        },
        resultSeq: (state.resultSeq || 0) + 1,
        myWords: p.accepted && p.word ? [...(state.myWords || []), p.word] : state.myWords || [],
      };
    }
    case 'race_racer_left': {
      if (!state || !state.racers) return state;
      return { ...state, racers: state.racers.map((r) => (r.id === p.racerId ? { ...r, left: true } : r)) };
    }
    case 'race_over': {
      if (!state) return state;
      const standings = Array.isArray(p.standings) ? p.standings : [];
      return {
        ...state,
        status: 'over',
        // Final positions come from the server's standings, never from local guesses.
        racers: (state.racers || []).map((r) => {
          const s = standings.find((x) => x.id === r.id);
          return s ? { ...r, index: s.words, left: !!s.left } : r;
        }),
        over: { winnerId: p.winnerId || null, reason: p.reason || null, standings },
      };
    }
    default:
      return state;
  }
}

/** A client-side reject (the three rules the client can decide from its own state). */
export function localResult(state, result) {
  if (!state) return state;
  return { ...state, lastResult: { ...result, local: true }, resultSeq: (state.resultSeq || 0) + 1 };
}

/** My current fragment, or null when I've finished / the race isn't set up. */
export function myFragment(state, myId) {
  if (!state || !state.racers) return null;
  const me = state.racers.find((r) => r.id === myId);
  if (!me) return null;
  return state.fragments[me.index] || null;
}

/**
 * The client mirror of the server's local rules (wordRace.js checkWord), same trim/lowercase,
 * same order. Returns a reason or null. `used` is MY used words only — a rival's words never
 * block me. The dictionary is the server's call.
 */
export function precheck(word, fragment, used) {
  const w = String(word || '').trim().toLowerCase();
  if (!fragment) return 'race_not_live';
  if (w.length < 3) return 'too_short';
  if (!w.includes(fragment)) return 'missing_combo';
  if (used && used.has(w)) return 'already_used';
  return null;
}
