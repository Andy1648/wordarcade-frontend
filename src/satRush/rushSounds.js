// rushSounds.js — the PRINT-SHOP sound set for SAT RUSH + FRENCH RUSH transitions (feat/french-rush-sound;
// Andy: "give some sound to the transitions"). Every transition of a run makes one short, quiet sound in the
// mode's own retro-print language: paper slides, ink ticks, pencil strikes, rubber stamps, a torn sheet.
// Synthesis only (house rule: no audio files) — filtered noise for paper, short sine bodies for ink/stamps.
//
// SHARED, NOT PARALLEL: every voice is built on the juice layer's ONE AudioContext and ONE master limiter
// (juice/audio.js), honors its mute (soundAllowed), the arcade SETTINGS mute (taw.sfxEvents = '0') and the
// arcade VOLUME (audioCore's master volume scales every peak). Never throws; silent without Web Audio.
// NEVER STACKED: soundGate.js lets only the most important transition sound inside a 140 ms window.
import { juiceSynth, getJuiceMaster } from '../juice/audio.js';
import { getMasterVolume } from '../audio/audioCore.js';
import { createGate, gateCue } from './soundGate.js';

const gate = createGate();
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function settingsMuted() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('taw.sfxEvents') === '0';
  } catch {
    return false;
  }
}

// The live context + master + the volume scale, or null when this cue must stay quiet.
function begin(name) {
  if (!juiceSynth.soundAllowed() || settingsMuted()) return null;
  if (!gateCue(gate, name, nowMs())) return null;
  const c = juiceSynth.getCtx();
  if (!c) return null;
  const dest = getJuiceMaster();
  if (!dest) return null;
  const vol = Math.max(0, Math.min(1, getMasterVolume()));
  if (vol <= 0) return null;
  return { c, dest, vol, t: c.currentTime };
}

// --- voices ---------------------------------------------------------------------------------------
// A short sine/triangle body with an optional pitch bend (an ink thunk, a stamp's body).
function body(s, { at = 0, freq, to = null, dur, peak, type = 'sine' }) {
  const { c, dest, vol } = s;
  const t = s.t + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak * vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A filtered noise burst — paper. `from`→`to` sweeps the filter (a slide rises, a tear opens up).
function paper(s, { at = 0, dur, peak, type = 'bandpass', from, to = null, q = 0.8, swell = 0 }) {
  const { c, dest, vol } = s;
  const t = s.t + at;
  const f = c.createBiquadFilter();
  f.type = type;
  f.Q.setValueAtTime(q, t);
  f.frequency.setValueAtTime(from, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  if (swell > 0) {
    // a slide swells in (paper drags, it doesn't click); the noise helper's gain is the decay
    juiceSynth.noise(c, { start: t, dur, peak: peak * vol * 0.35, filter: f, dest });
    const f2 = c.createBiquadFilter();
    f2.type = type;
    f2.Q.setValueAtTime(q, t);
    f2.frequency.setValueAtTime(to || from, t + swell);
    juiceSynth.noise(c, { start: t + swell, dur: Math.max(0.02, dur - swell), peak: peak * vol, filter: f2, dest });
    return;
  }
  juiceSynth.noise(c, { start: t, dur, peak: peak * vol, filter: f, dest });
}

function play(name, fn) {
  const s = begin(name);
  if (!s) return false;
  try {
    fn(s);
  } catch {
    /* never let audio throw */
  }
  return true;
}

// --- the transitions --------------------------------------------------------------------------------

/** A new card slides onto the desk: a soft paper slide. */
export function sndCardIn() {
  return play('cardIn', (s) => {
    paper(s, { dur: 0.15, peak: 0.07, from: 900, to: 2600, q: 0.7, swell: 0.04 });
  });
}

/** The clue stage decays (the reward drops a notch): a dry ink tick, lower as the reward falls. */
export function sndStageTick(progress = 0) {
  const p = Math.max(0, Math.min(1, progress)); // 1 = top reward, 0 = last stage
  return play('tick', (s) => {
    body(s, { freq: 300 + p * 260, to: 220 + p * 180, dur: 0.06, peak: 0.1, type: 'triangle' });
    paper(s, { dur: 0.018, peak: 0.05, type: 'highpass', from: 3200 });
  });
}

/** A choice is crossed out / a letter is spelled in: a quick pencil strike. */
export function sndStrike() {
  return play('strike', (s) => {
    paper(s, { dur: 0.075, peak: 0.07, from: 3600, to: 1700, q: 1.4 });
  });
}

/** CAPTURED: a rubber stamp hits the poster — a low thunk, a dry crack, and a small ping that climbs
 * with the streak (a hot run sounds hotter; C minor pentatonic like the arcade's accept). */
export function sndCapture(streak = 0) {
  const PENT = [0, 3, 5, 7, 10];
  const d = Math.max(0, Math.min(9, Math.floor(streak)));
  const semi = PENT[d % 5] + 12 * Math.floor(d / 5);
  const ping = 523.25 * Math.pow(2, semi / 12);
  return play('capture', (s) => {
    body(s, { freq: 170, to: 60, dur: 0.14, peak: 0.22 });
    paper(s, { dur: 0.045, peak: 0.12, type: 'lowpass', from: 1400 });
    body(s, { at: 0.035, freq: ping, dur: 0.13, peak: 0.07, type: 'triangle' });
  });
}

/** ESCAPED: the poster tears — a ripping sweep over a dull ink thud. */
export function sndMiss() {
  return play('miss', (s) => {
    body(s, { freq: 120, to: 48, dur: 0.2, peak: 0.16 });
    paper(s, { dur: 0.24, peak: 0.13, from: 500, to: 3400, q: 0.9 });
    paper(s, { at: 0.07, dur: 0.12, peak: 0.07, type: 'highpass', from: 2400 });
  });
}

/** An escaped word is BACK: the poster is re-stamped twice, quickly (thunk-thunk). */
export function sndRevenant() {
  return play('revenant', (s) => {
    body(s, { freq: 150, to: 62, dur: 0.1, peak: 0.16 });
    paper(s, { dur: 0.03, peak: 0.08, type: 'lowpass', from: 1300 });
    body(s, { at: 0.11, freq: 120, to: 50, dur: 0.13, peak: 0.18 });
    paper(s, { at: 0.11, dur: 0.035, peak: 0.09, type: 'lowpass', from: 1100 });
  });
}

/** A DEEP CUT (MOST WANTED) lands: a heavy sheet slapped down on the desk. */
export function sndDeepCut() {
  return play('deepCut', (s) => {
    paper(s, { dur: 0.2, peak: 0.08, from: 450, to: 1500, q: 0.7, swell: 0.08 });
    body(s, { at: 0.12, freq: 95, to: 38, dur: 0.26, peak: 0.2 });
    paper(s, { at: 0.12, dur: 0.05, peak: 0.1, type: 'lowpass', from: 900 });
  });
}

/** The run ends (CASE CLOSED / the last life): one big stamp, a low ring under it. */
export function sndCaseClosed() {
  return play('caseClosed', (s) => {
    body(s, { freq: 140, to: 40, dur: 0.34, peak: 0.26 });
    paper(s, { dur: 0.08, peak: 0.16, type: 'lowpass', from: 1000 });
    body(s, { at: 0.02, freq: 196, dur: 0.4, peak: 0.05, type: 'triangle' });
  });
}

/** A screen change — a sheet comes off the press: the type clicks in, then the sheet is pulled.
 * `short` = the quick in-screen press (≈ PRESS_SHORT_MS); timing tracks press.js. */
export function sndPress(short = false) {
  return play('press', (s) => {
    for (let i = 0; i < 3; i += 1) paper(s, { at: 0.03 + i * 0.05, dur: 0.014, peak: 0.05, type: 'highpass', from: 2800 });
    paper(s, { at: short ? 0.3 : 0.43, dur: 0.2, peak: 0.08, from: 700, to: 2400, q: 0.7, swell: 0.05 });
  });
}
