// labSounds.js — the POWERS LAB's synth cues (Web Audio, no files). Built on the shared audioCore
// (one context, one limiter, C minor pentatonic) so the cues sit in the game's key.
import { ensureCtx, audioCtx, masterNode, registerVoice, tone, pentFreq, NOTE } from '../audio/audioCore';

const now = () => (audioCtx() ? audioCtx().currentTime : 0);

/** Call inside the first user gesture. */
export function wakeAudio() {
  return ensureCtx();
}

// A held voice (start → stop later). Fresh nodes each time; returns { stop(releaseS) }.
function held({ freq, type = 'sine', gain = 0.12, glideTo = null, glideS = 0.6, lowpass = null }) {
  const ctx = audioCtx();
  const out = masterNode();
  if (!ctx || !out) return { stop() {} };
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + glideS);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  let head = g;
  if (lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    g.connect(lp);
    head = lp;
  }
  osc.connect(g);
  head.connect(out);
  osc.start(t);
  const voice = { osc, gain: g, stopAt: t + 30 };
  registerVoice(voice);
  let stopped = false;
  return {
    stop(release = 0.08) {
      if (stopped) return;
      stopped = true;
      const s = ctx.currentTime;
      try {
        g.gain.cancelScheduledValues(s);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), s);
        g.gain.exponentialRampToValueAtTime(0.0001, s + release);
        osc.stop(s + release + 0.02);
        voice.stopAt = s + release + 0.02;
      } catch { /* already stopped */ }
    },
    glide(toFreq, s = 0.1) {
      try { osc.frequency.exponentialRampToValueAtTime(toFreq, ctx.currentTime + s); } catch { /* ignore */ }
    },
  };
}

// ---- HOLD BREATH: a drop into slow-mo, a low held drone, a heartbeat, a gasp on release ----
export function breathIn() {
  const t = now();
  tone(t, { freq: 520, glideTo: 90, dur: 0.32, type: 'sawtooth', gain: 0.09, lowpass: 900 });
  tone(t, { freq: pentFreq(NOTE.C3), dur: 0.4, type: 'sine', gain: 0.18 });
  return held({ freq: 65, type: 'triangle', gain: 0.07, lowpass: 400 });
}
export function heartbeat() {
  const t = now();
  tone(t, { freq: 70, glideTo: 45, dur: 0.12, type: 'sine', gain: 0.28 });
  tone(t + 0.16, { freq: 62, glideTo: 40, dur: 0.1, type: 'sine', gain: 0.2 });
}
export function breathOut() {
  tone(now(), { freq: 160, glideTo: 640, dur: 0.22, type: 'triangle', gain: 0.1, lowpass: 2400 });
}
export function breathEmpty() {
  const t = now();
  tone(t, { freq: 220, glideTo: 110, dur: 0.18, type: 'square', gain: 0.06, lowpass: 1200 });
}

// ---- WIND-UP: a rising riser while held, a thump + crack on a full SLAM ----
export function windupStart() {
  return held({ freq: 110, type: 'sawtooth', gain: 0.06, glideTo: 440, glideS: 0.6, lowpass: 1800 });
}
export function windupFull() {
  tone(now(), { freq: pentFreq(NOTE.G5), dur: 0.08, type: 'square', gain: 0.07 });
}
export function slam() {
  const t = now();
  tone(t, { freq: 160, glideTo: 38, dur: 0.28, type: 'sine', gain: 0.32 });
  tone(t, { freq: 2400, glideTo: 300, dur: 0.09, type: 'square', gain: 0.07, lowpass: 5000 });
  tone(t + 0.05, { freq: pentFreq(NOTE.C5), dur: 0.16, type: 'triangle', gain: 0.12 });
  tone(t + 0.1, { freq: pentFreq(NOTE.G5), dur: 0.2, type: 'triangle', gain: 0.1 });
}

// ---- AUTOCORRECT: a typewriter strike, a carriage-return ding ----
export function autocorrectFix() {
  const t = now();
  tone(t, { freq: 1800, glideTo: 900, dur: 0.03, type: 'square', gain: 0.08 });
  tone(t + 0.07, { freq: 1600, glideTo: 800, dur: 0.03, type: 'square', gain: 0.07 });
  tone(t + 0.16, { freq: pentFreq(NOTE.C6), dur: 0.5, type: 'sine', gain: 0.14 });
  tone(t + 0.16, { freq: pentFreq(NOTE.G5), dur: 0.4, type: 'sine', gain: 0.06 });
}
export function pipFilled(i) {
  tone(now(), { freq: pentFreq(NOTE.C5 + i), dur: 0.07, type: 'triangle', gain: 0.08 });
}
export function armed() {
  const t = now();
  tone(t, { freq: pentFreq(NOTE.G4), dur: 0.08, type: 'triangle', gain: 0.1 });
  tone(t + 0.07, { freq: pentFreq(NOTE.C5), dur: 0.12, type: 'triangle', gain: 0.1 });
}

// ---- ONE ROW: one note per letter running up the row, then a chord hit ----
export function oneRow(letters) {
  const t = now();
  const n = Math.min(letters, 10);
  for (let i = 0; i < n; i++) tone(t + i * 0.045, { freq: pentFreq(NOTE.C4 + i), dur: 0.09, type: 'square', gain: 0.05 });
  const e = t + n * 0.045 + 0.02;
  tone(e, { freq: pentFreq(NOTE.C5), dur: 0.35, type: 'triangle', gain: 0.12 });
  tone(e, { freq: pentFreq(NOTE.G5), dur: 0.35, type: 'triangle', gain: 0.08 });
}

// ---- the base game ----
export function accept() {
  const t = now();
  tone(t, { freq: pentFreq(NOTE.G4), dur: 0.08, type: 'triangle', gain: 0.12 });
  tone(t + 0.06, { freq: pentFreq(NOTE.C5), dur: 0.12, type: 'triangle', gain: 0.12 });
}
export function reject() {
  tone(now(), { freq: 180, glideTo: 120, dur: 0.16, type: 'square', gain: 0.07, lowpass: 1400 });
}
export function boom() {
  const t = now();
  tone(t, { freq: 120, glideTo: 30, dur: 0.5, type: 'sawtooth', gain: 0.22, lowpass: 600 });
  tone(t, { freq: 60, glideTo: 25, dur: 0.6, type: 'sine', gain: 0.3 });
}
export function tick(urgent) {
  tone(now(), { freq: urgent ? 1400 : 1000, dur: 0.025, type: 'square', gain: urgent ? 0.05 : 0.03 });
}

// ================= ROUND 2 =================
// SLINGSHOT: a rubber band creaking tighter while held; a whoosh + thwack on release; a thwang on a dud
export function slingPull() {
  return held({ freq: 90, type: 'sawtooth', gain: 0.05, glideTo: 360, glideS: 1.0, lowpass: 1200 });
}
export function slingFire(pull) {
  const t = now();
  tone(t, { freq: 900, glideTo: 140, dur: 0.22, type: 'sawtooth', gain: 0.08, lowpass: 3000 });
  tone(t + 0.02, { freq: 200 + 300 * pull, glideTo: 60, dur: 0.18, type: 'sine', gain: 0.25 });
  tone(t + 0.12, { freq: pentFreq(NOTE.G5), dur: 0.14, type: 'triangle', gain: 0.1 });
}
export function slingSnap() {
  const t = now();
  tone(t, { freq: 320, glideTo: 180, dur: 0.18, type: 'square', gain: 0.06, lowpass: 1600 });
  tone(t + 0.05, { freq: 240, glideTo: 200, dur: 0.12, type: 'square', gain: 0.04, lowpass: 1600 });
}
// CAPS RAGE: a growl up on, a sigh down off
export function rageOn() {
  const t = now();
  tone(t, { freq: 70, glideTo: 160, dur: 0.35, type: 'sawtooth', gain: 0.18, lowpass: 900 });
  tone(t, { freq: 72, glideTo: 170, dur: 0.35, type: 'square', gain: 0.07, lowpass: 700 });
  tone(t + 0.05, { freq: pentFreq(NOTE.C4), dur: 0.2, type: 'square', gain: 0.06 });
}
export function rageOff() {
  tone(now(), { freq: 300, glideTo: 120, dur: 0.3, type: 'triangle', gain: 0.08, lowpass: 1500 });
}
// STOMP: each stomp a thud one step higher
export function stomp(i) {
  const t = now();
  tone(t, { freq: 90, glideTo: 50, dur: 0.08, type: 'sine', gain: 0.3 });
  tone(t, { freq: pentFreq(NOTE.C4 + Math.min(i, 10)), dur: 0.06, type: 'square', gain: 0.05 });
}
export function stompUp() {
  const t = now();
  tone(t, { freq: pentFreq(NOTE.C5), dur: 0.06, type: 'square', gain: 0.06 });
  tone(t + 0.08, { freq: pentFreq(NOTE.C5), dur: 0.06, type: 'square', gain: 0.06 });
}
// ASCEND: a riser while held, a big chord on full, a falling sigh when let go early
export function ascendRiser() {
  return held({ freq: 55, type: 'sawtooth', gain: 0.09, glideTo: 440, glideS: 2.0, lowpass: 2200 });
}
export function ascendBoom() {
  const t = now();
  tone(t, { freq: 140, glideTo: 30, dur: 0.7, type: 'sine', gain: 0.35 });
  [NOTE.C5, NOTE.Eb5, NOTE.G5, NOTE.C6].forEach((n, i) => tone(t + 0.04 + i * 0.05, { freq: pentFreq(n), dur: 0.9, type: 'triangle', gain: 0.09 }));
}
export function ascendDrop() {
  tone(now(), { freq: 300, glideTo: 80, dur: 0.35, type: 'triangle', gain: 0.08 });
}
// CHEST: a knock per hit (climbing), a pop when it opens
export function chestHit(i) {
  const t = now();
  tone(t, { freq: 130 + i * 6, glideTo: 70, dur: 0.07, type: 'square', gain: 0.07, lowpass: 900 });
  tone(t, { freq: pentFreq(NOTE.C4 + (i % 12)), dur: 0.05, type: 'triangle', gain: 0.06 });
}
export function chestOpen(gold) {
  const t = now();
  tone(t, { freq: 200, glideTo: 900, dur: 0.18, type: 'sawtooth', gain: 0.07, lowpass: 3000 });
  const notes = gold ? [NOTE.C5, NOTE.Eb5, NOTE.G5, NOTE.Bb5, NOTE.C6] : [NOTE.C5, NOTE.G5, NOTE.C6];
  notes.forEach((n, i) => tone(t + 0.12 + i * 0.06, { freq: pentFreq(n), dur: 0.3, type: 'triangle', gain: 0.1 }));
}
// LEVEL UP: each typed letter stamps one note higher; a fanfare at the end
export function stampLetter(i) {
  const t = now();
  tone(t, { freq: 110, glideTo: 60, dur: 0.06, type: 'sine', gain: 0.25 });
  tone(t, { freq: pentFreq(NOTE.C5 + i), dur: 0.12, type: 'square', gain: 0.06 });
}
export function levelFanfare() {
  const t = now();
  [NOTE.C5, NOTE.Eb5, NOTE.G5, NOTE.C6].forEach((n, i) => tone(t + i * 0.08, { freq: pentFreq(n), dur: 0.35, type: 'square', gain: 0.06 }));
  tone(t + 0.32, { freq: pentFreq(NOTE.C6), dur: 0.6, type: 'triangle', gain: 0.12 });
}
