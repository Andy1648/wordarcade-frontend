// live.js — STEP 51 (Andy oct2): LIVE features on free Supabase Realtime — how many people are
// online right now, and a ticker of other players' moments ("NAME just hit LV 50", "NAME took #3").
//
// No supabase-js: Realtime is a Phoenix channel over one WebSocket, and the handful of frames this
// needs (join, presence track, broadcast, heartbeat) are written by hand below (~0 KB of dependency).
// Probed against the project with the public key: presence state/diff and broadcast both deliver.
//
// TRUST: a public channel accepts anyone's broadcast, so the ticker NEVER renders text it was sent.
// A message is a {k, n, v} triple — kind, name, number — and is dropped unless the kind is known,
// the name passes the same name filter the board enforces, and the number is an integer in range.
// The UI renders it from a fixed template. Presence can be inflated by a script; it's a vibe number.
//
// COST: one socket per open menu, heartbeat every 25 s, dropped after 60 s in a hidden tab.
import { LEADERBOARD_ENABLED, getMyProfile } from './client.js';
import { nameVerdict } from './nameFilter.js';
import { ROLL_TICK_TIERS } from './tickText.js';

const RAW_URL = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '';
const KEY = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '';
const HOST = RAW_URL.replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const TOPIC = 'realtime:taw-lobby';
const HEARTBEAT_MS = 25000;
const HIDDEN_DROP_MS = 60000;
export const TICKER_KINDS = ['lv', 'rank', 'rb', 'roll'];

let ws = null;
let ref = 1;
let hb = null;
let hiddenTimer = null;
let online = 0;
let pending = []; // ticks announced before the channel joined
const listeners = new Set();
const presenceKey = `p${Math.random().toString(36).slice(2, 10)}`;

function emit(evt) {
  for (const fn of listeners) {
    try {
      fn(evt);
    } catch {
      /* a listener never breaks the socket */
    }
  }
}
function send(topic, event, payload) {
  if (!ws || ws.readyState !== 1) return false;
  ws.send(JSON.stringify({ topic, event, payload, ref: String(ref++) }));
  return true;
}

/** A ticker message, validated. Returns null when it is not one we will render. */
export function cleanTick(p) {
  if (!p || typeof p !== 'object') return null;
  const k = TICKER_KINDS.includes(p.k) ? p.k : null;
  const n = typeof p.n === 'string' ? p.n.trim() : '';
  const v = Number(p.v);
  if (!k || !n || n.length > 16 || nameVerdict(n, { cjk: true }) !== 'ok') return null;
  if (!Number.isInteger(v) || v < 1 || v > (k === 'rank' ? 100 : 100000)) return null;
  if (k === 'roll' && !ROLL_TICK_TIERS[v]) return null; // only MYTHIC / SECRET codes
  return { k, n, v };
}

function countPresence(state) {
  return state && typeof state === 'object' ? Object.keys(state).length : 0;
}
let presence = {};

function connect() {
  // e2e builds point at lb.e2e.invalid (REST is mocked; a socket would only log a red error).
  if (ws || !LEADERBOARD_ENABLED || !HOST || /\.invalid$/.test(HOST) || typeof WebSocket === 'undefined') return;
  try {
    ws = new WebSocket(`wss://${HOST}/realtime/v1/websocket?apikey=${encodeURIComponent(KEY)}&vsn=1.0.0`);
  } catch {
    ws = null;
    return;
  }
  ws.onopen = () => {
    send(TOPIC, 'phx_join', { config: { broadcast: { self: false }, presence: { key: presenceKey } } });
    hb = setInterval(() => send('phoenix', 'heartbeat', {}), HEARTBEAT_MS);
  };
  ws.onmessage = (m) => {
    let d;
    try {
      d = JSON.parse(m.data);
    } catch {
      return;
    }
    if (d.topic !== TOPIC) return;
    if (d.event === 'phx_reply' && d.payload && d.payload.status === 'ok' && !ws.tracked) {
      ws.tracked = true;
      send(TOPIC, 'presence', { type: 'presence', event: 'track', payload: { at: Date.now() } });
      for (const t of pending) send(TOPIC, 'broadcast', { type: 'broadcast', event: 'tick', payload: t });
      pending = [];
    } else if (d.event === 'presence_state') {
      presence = { ...(d.payload || {}) };
      online = countPresence(presence);
      emit({ type: 'online', online });
    } else if (d.event === 'presence_diff') {
      const p = d.payload || {};
      for (const k of Object.keys(p.joins || {})) presence[k] = p.joins[k];
      for (const k of Object.keys(p.leaves || {})) delete presence[k];
      online = countPresence(presence);
      emit({ type: 'online', online });
    } else if (d.event === 'broadcast' && d.payload && d.payload.event === 'tick') {
      const t = cleanTick(d.payload.payload);
      if (t) emit({ type: 'tick', tick: t });
    }
  };
  const drop = () => {
    clearInterval(hb);
    hb = null;
    ws = null;
    presence = {};
  };
  ws.onclose = drop;
  ws.onerror = () => {
    try {
      ws && ws.close();
    } catch {
      /* closing */
    }
  };
}
function disconnect() {
  if (!ws) return;
  try {
    ws.close();
  } catch {
    /* closing */
  }
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    clearTimeout(hiddenTimer);
    hiddenTimer = setTimeout(disconnect, HIDDEN_DROP_MS);
  } else {
    clearTimeout(hiddenTimer);
    if (listeners.size) connect();
  }
}

/** Subscribe to {type:'online', online} and {type:'tick', tick}. Connects on first subscriber. */
export function subscribeLive(fn) {
  listeners.add(fn);
  if (listeners.size === 1 && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  connect();
  if (online) fn({ type: 'online', online });
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      disconnect();
    }
  };
}

/** Announce MY moment to everyone on the menu (claimed players only). */
export function announceTick(k, v) {
  const me = getMyProfile();
  if (!me) return false;
  const t = cleanTick({ k, n: me.username, v });
  if (!t) return false;
  connect();
  if (ws && ws.tracked && send(TOPIC, 'broadcast', { type: 'broadcast', event: 'tick', payload: t })) return true;
  pending = [...pending, t].slice(-3);
  return true;
}

/** The ticker tier code for a rolled tier (MYTHIC 4, SECRET 5), or 0 when it isn't worth a line. */
export function rollTickCode(tier) {
  return tier === 'mythic' ? 4 : tier === 'secret' ? 5 : 0;
}
/**
 * MARK ROLLS: one line per MYTHIC+ result ("NAME ROLLED MYTHIC") — called when the reveal LANDS (no spoilers).
 * `results` = the shown roll + any DOUBLE ROLLS extra. Unclaimed players post nothing (announceTick). Best-effort:
 * never throws. Returns how many lines were posted.
 */
export function announceRolls(results) {
  let n = 0;
  try {
    for (const r of results || []) {
      const v = r ? rollTickCode(r.tier) : 0;
      if (v && announceTick('roll', v)) n += 1;
    }
  } catch {
    /* the ticker never breaks a roll */
  }
  return n;
}

/** Level milestones worth telling the room about. */
export function isLevelMilestone(lv) {
  return lv === 10 || lv === 25 || (lv >= 50 && lv % 50 === 0);
}
