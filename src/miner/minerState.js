// minerState.js — MINER client state, as a PURE reducer over the server's miner_* frames.
//
// The server is the only source of truth (prompts, judging, depth, the winner); this mirrors what it was
// told, in arrival order (App dispatches every drained frame from the FIFO queue, so two frames in one tick
// are both applied). Clock: timed frames carry `serverNow`; `offset = serverNow - localNow` converts
// endsAt / goAt to the local clock so a countdown reads right on a device whose clock is off.
//
// Action: { frame: { type, payload }, now } | { type: 'reset' } | { type: 'local', result }.

export const EMPTY_MINER = null;

function offsetOf(p, now, prev) {
  return Number.isFinite(p?.serverNow) ? p.serverNow - now : prev || 0;
}
const toLocal = (ms, offset) => (Number.isFinite(ms) ? ms - offset : null);

function mergeMiners(prev, snap) {
  if (!Array.isArray(snap)) return prev;
  return snap.map((m) => ({ ...(prev.find((x) => x.id === m.id) || {}), ...m }));
}

export function minerReducer(state, action) {
  if (!action) return state;
  if (action.type === 'reset') return EMPTY_MINER;
  if (action.type === 'local') {
    if (!state) return state;
    return { ...state, lastResult: { ...action.result, local: true }, resultSeq: (state.resultSeq || 0) + 1 };
  }
  const { frame, now = Date.now() } = action;
  if (!frame || typeof frame.type !== 'string') return state;
  const p = frame.payload || {};

  switch (frame.type) {
    case 'miner_queue': {
      const offset = offsetOf(p, now, state?.offset);
      return {
        ...(state && state.status === 'queue' ? state : {}),
        status: 'queue',
        code: p.code,
        humans: p.humans || 1,
        maxMiners: p.maxMiners || 6,
        fillAt: now + (Number(p.fillInMs) || 0),
        offset,
      };
    }
    case 'miner_start': {
      const offset = offsetOf(p, now, 0);
      return {
        status: 'countdown',
        gameKey: `${p.serverNow || now}`,
        miners: (p.miners || []).map((m) => ({ ...m, locked: false })),
        target: p.target || 500,
        lives: p.lives || 3,
        offset,
        goAt: toLocal(p.goAt, offset),
        round: 0,
        prompt: null,
        endsAt: null,
        roundMs: 15000,
        myPick: null,
        lastResult: null,
        resultSeq: 0,
        reveal: null,
        over: null,
      };
    }
    case 'miner_round': {
      if (!state) return state;
      const offset = offsetOf(p, now, state.offset);
      return {
        ...state,
        status: 'digging',
        offset,
        round: p.round,
        prompt: p.prompt,
        // the singular line the miner hunts (Andy oct27: "pizza topping", not "pizza toppings")
        ask: p.ask || String(p.prompt || '').toUpperCase(),
        pack: p.pack || null,
        endsAt: toLocal(p.endsAt, offset),
        roundMs: p.roundMs || state.roundMs,
        myPick: null,
        lastResult: null,
        reveal: null,
        miners: state.miners.map((m) => ({ ...m, locked: false })),
      };
    }
    case 'miner_result': {
      if (!state) return state;
      const myPick = p.accepted ? { answer: p.answer, ore: p.ore, depth: p.depth, top: p.top ?? null } : state.myPick;
      return { ...state, myPick, lastResult: { ...p }, resultSeq: (state.resultSeq || 0) + 1 };
    }
    case 'miner_locked': {
      if (!state) return state;
      const ids = new Set(p.ids || []);
      return { ...state, miners: state.miners.map((m) => ({ ...m, locked: ids.has(m.id) })) };
    }
    case 'miner_reveal': {
      if (!state) return state;
      const offset = offsetOf(p, now, state.offset);
      return {
        ...state,
        status: 'reveal',
        offset,
        reveal: {
          round: p.round,
          prompt: p.prompt,
          ask: p.ask || state.ask || String(p.prompt || '').toUpperCase(),
          picks: p.picks || [],
          diamond: p.diamond || null,
          nextAt: now + (Number(p.nextInMs) || 0),
          over: !!p.over,
        },
        miners: mergeMiners(state.miners, p.miners).map((m) => ({ ...m, locked: false })),
      };
    }
    case 'miner_left': {
      if (!state) return state;
      return { ...state, miners: state.miners.map((m) => (m.id === p.id ? { ...m, left: true } : m)) };
    }
    case 'miner_over': {
      if (!state) return state;
      return {
        ...state,
        status: 'over',
        over: {
          winnerIds: p.winnerIds || [],
          reason: p.reason,
          standings: p.standings || [],
          rounds: p.rounds || state.round,
        },
      };
    }
    default:
      return state;
  }
}

/** My picks across the game, folded from reveals (App keeps them as the history; pure helper for tests). */
export function pickFor(reveal, id) {
  return reveal && Array.isArray(reveal.picks) ? reveal.picks.find((x) => x.id === id) || null : null;
}

/** Seconds left on a local deadline (never negative). */
export function secondsLeft(deadline, now) {
  return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}
