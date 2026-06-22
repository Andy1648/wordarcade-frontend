// useSoundEffects.js
// Programmatic sound effects for Word Bomb, synthesized entirely with the Web
// Audio API - no audio files. A single AudioContext is created lazily on the
// first user interaction (browsers block audio before a gesture), stored in a
// ref, and closed on unmount. Every method is wrapped in try/catch so a browser
// without Web Audio support (or a transient audio error) can never crash the
// game - sound simply doesn't play.

import { useEffect, useRef } from 'react';

// ---- Module-level synthesis helpers (pure; take the live AudioContext) ----

// A single enveloped tone. `type` is the oscillator wave, `peak` the gain at
// the top of a 10ms attack, then an exponential decay to silence by `dur`.
function playTone(ctx, { freq, type, start, dur, peak }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  // exponentialRamp can't target 0, so we floor at a near-silent 0.0001.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// A burst of white noise (random samples in an AudioBuffer) with an
// exponential gain decay - used for the explosion and the fuse crackle.
function playNoise(ctx, { start, dur, peak }) {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(gain).connect(ctx.destination);
  src.start(start);
  src.stop(start + dur + 0.01);
}

// Builds the sound API around a set of refs (so the returned object has a
// stable identity across renders - effects can depend on it without churning).
function createSoundApi(ctxRef, mutedRef, sizzleRef) {
  // Lazily create (and resume) the shared AudioContext. Called on the first
  // interaction via unlock(), and defensively by every method.
  function getCtx() {
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctxRef.current = new AC();
      }
      // Autoplay policy can leave a freshly-made context suspended until a
      // gesture resumes it.
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume().catch(() => {});
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }

  return {
    // Create/resume the context inside a user gesture so audio is allowed.
    unlock() {
      getCtx();
    },

    // Per-second turn tick. A subtle square-wave click whose pitch rises with
    // urgency (0 -> 600Hz calm, 1 -> 1200Hz tense), so the tick naturally gets
    // higher as time runs out. Low gain since it plays every second.
    tick(urgency = 0) {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const u = Math.max(0, Math.min(1, urgency));
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600 + u * 600, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.005); // 5ms attack
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03); // 25ms release
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.035);
      } catch {
        /* never let audio crash the game */
      }
    },

    // Accepted word: a pleasant two-tone rising chime (880Hz -> 1320Hz, a
    // musical fifth) on clean sine waves, with a 30ms gap between tones.
    correctDing() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playTone(ctx, { freq: 880, type: 'sine', start: now, dur: 0.08, peak: 0.25 });
        playTone(ctx, { freq: 1320, type: 'sine', start: now + 0.11, dur: 0.12, peak: 0.25 });
      } catch {
        /* no-op */
      }
    },

    // Rejected word: a short low square-wave buzz with a sustain.
    wrongBuzz() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.01); // quick attack
        gain.gain.setValueAtTime(0.2, now + 0.12); // sustain
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15); // quick release
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch {
        /* no-op */
      }
    },

    // Life lost: a white-noise burst decaying over 400ms, with a 60Hz sine
    // "thud" layered underneath for the first 200ms.
    explosion() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playNoise(ctx, { start: now, dur: 0.4, peak: 0.4 });
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      } catch {
        /* no-op */
      }
    },

    // Skip your turn: a quick descending "whomp" - a sine sliding 400Hz -> 200Hz
    // over 200ms, like a deflating sigh.
    skip() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.2); // slide down
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.01); // quick attack to 0.15
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2); // out by 200ms
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      } catch {
        /* no-op */
      }
    },

    // ---- App-wide UI / transition / outcome sounds ----

    // Heavy impact for the "TYPE FAST" / "DIE SLOW" slams: a very short noise
    // burst + a low 80Hz thud + a tiny high "crack" ping. A fist hitting a wall.
    punch() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playNoise(ctx, { start: now, dur: 0.05, peak: 0.3 }); // 50ms slap
        // Low body thud (80Hz, decaying over 100ms).
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        // High crack on top (1000Hz, 20ms).
        playTone(ctx, { freq: 1000, type: 'sine', start: now, dur: 0.02, peak: 0.1 });
      } catch {
        /* no-op */
      }
    },

    // Snappy, very subtle UI click for every button in the app. Short enough
    // (15ms, low gain) that it never grates even on rapid presses.
    click() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.02);
      } catch {
        /* no-op */
      }
    },

    // Transition swoosh: bandpassed white noise (centred 2kHz, Q 1) swelling in
    // over 100ms then out over 200ms - a fast whoosh under a screen wipe.
    whoosh() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const dur = 0.3;
        const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.Q.setValueAtTime(1, now);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1); // swell in
        gain.gain.linearRampToValueAtTime(0.0001, now + 0.3); // out
        src.connect(filter).connect(gain).connect(ctx.destination);
        src.start(now);
        src.stop(now + 0.31);
      } catch {
        /* no-op */
      }
    },

    // Barely-there hover blip for the homepage game cards (660Hz, 30ms, very
    // quiet). The "once per card" gating lives at the call site.
    menuHover() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        playTone(ctx, { freq: 660, type: 'sine', start: ctx.currentTime, dur: 0.03, peak: 0.06 });
      } catch {
        /* no-op */
      }
    },

    // 3-2-1-GO countdown beep. The numbers are a 440Hz blip; GO! jumps an octave
    // (880Hz), louder and longer, so the pitch change itself signals "now!".
    countdown(isGo = false) {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        if (isGo) {
          playTone(ctx, { freq: 880, type: 'sine', start: now, dur: 0.2, peak: 0.3 });
        } else {
          playTone(ctx, { freq: 440, type: 'sine', start: now, dur: 0.1, peak: 0.2 });
        }
      } catch {
        /* no-op */
      }
    },

    // KO / elimination: a heavy low sine bending 100Hz -> 50Hz over 300ms, with a
    // sharp metallic (high-Q bandpassed) noise clang layered in at 200ms.
    ko() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.3); // pitch bend down
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
        // Metallic clang at 200ms: high-Q bandpassed noise burst.
        const t = now + 0.2;
        const dur = 0.12;
        const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
        const nSrc = ctx.createBufferSource();
        nSrc.buffer = buf;
        const filt = ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.setValueAtTime(3000, t);
        filt.Q.setValueAtTime(8, t);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.25, t);
        nGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        nSrc.connect(filt).connect(nGain).connect(ctx.destination);
        nSrc.start(t);
        nSrc.stop(t + dur + 0.01);
      } catch {
        /* no-op */
      }
    },

    // Win fanfare: an ascending C-E-G major arpeggio on clean sines.
    victory() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playTone(ctx, { freq: 523.25, type: 'sine', start: now, dur: 0.15, peak: 0.25 }); // C5
        playTone(ctx, { freq: 659.25, type: 'sine', start: now + 0.15, dur: 0.15, peak: 0.25 }); // E5
        playTone(ctx, { freq: 783.99, type: 'sine', start: now + 0.3, dur: 0.3, peak: 0.25 }); // G5
      } catch {
        /* no-op */
      }
    },

    // Lose sound: two descending sine notes (400Hz -> 200Hz), sad and deflating.
    defeat() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playTone(ctx, { freq: 400, type: 'sine', start: now, dur: 0.2, peak: 0.2 });
        playTone(ctx, { freq: 200, type: 'sine', start: now + 0.2, dur: 0.4, peak: 0.2 });
      } catch {
        /* no-op */
      }
    },

    // Ambient fuse crackle during your turn: tiny 10ms noise bursts at random
    // 100-300ms intervals, very quiet. Idempotent start; stoppable.
    startSizzle() {
      const ctx = getCtx();
      if (!ctx) return;
      if (sizzleRef.current) return; // already running
      const state = { active: true, timeoutId: null };
      sizzleRef.current = state;
      const scheduleNext = () => {
        if (!state.active) return;
        const delay = 100 + Math.random() * 200; // 100-300ms
        state.timeoutId = setTimeout(() => {
          if (!state.active) return;
          // Gate playback (not scheduling) on mute, so unmuting mid-turn works.
          if (!mutedRef.current) {
            try {
              playNoise(ctx, { start: ctx.currentTime, dur: 0.01, peak: 0.05 });
            } catch {
              /* no-op */
            }
          }
          scheduleNext();
        }, delay);
      };
      scheduleNext();
    },

    stopSizzle() {
      const state = sizzleRef.current;
      if (!state) return;
      state.active = false;
      if (state.timeoutId) clearTimeout(state.timeoutId);
      sizzleRef.current = null;
    },
  };
}

/**
 * Returns a stable sound API for Word Bomb. `muted` flips every method to a
 * no-op (read live via a ref, so toggling doesn't recreate the API). The
 * AudioContext is created lazily on the first call to unlock()/any method and
 * closed when the component unmounts.
 */
export function useSoundEffects(muted) {
  const ctxRef = useRef(null);
  const mutedRef = useRef(muted);
  const sizzleRef = useRef(null);
  const apiRef = useRef(null);

  if (!apiRef.current) {
    apiRef.current = createSoundApi(ctxRef, mutedRef, sizzleRef);
  }

  // Keep the muted flag the methods read in sync with the prop.
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Tear down on unmount: stop the sizzle loop and close the context.
  useEffect(() => {
    return () => {
      try {
        apiRef.current?.stopSizzle();
      } catch {
        /* no-op */
      }
      try {
        if (ctxRef.current) {
          ctxRef.current.close();
          ctxRef.current = null;
        }
      } catch {
        /* no-op */
      }
    };
  }, []);

  return apiRef.current;
}
