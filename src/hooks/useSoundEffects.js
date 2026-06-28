// useSoundEffects.js
// Programmatic sound effects for Word Bomb, synthesized entirely with the Web
// Audio API - no audio files. A single AudioContext is created lazily on the
// first user interaction (browsers block audio before a gesture), stored in a
// ref, and closed on unmount. Every method is wrapped in try/catch so a browser
// without Web Audio support (or a transient audio error) can never crash the
// game - sound simply doesn't play.

import { useEffect, useRef } from 'react';
import { getJuiceCtx, getJuiceMaster } from '../juice/audio';
import { JUICE } from '../juice/config';

// JUICE 04 — single shared mix-level table (peak gains per cue). One source of
// truth so the whole game is balanced in one place; see juice/config.js.
const MIX = JUICE.MIX;

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
  osc.connect(gain).connect(getMaster(ctx));
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
  src.connect(gain).connect(getMaster(ctx));
  src.start(start);
  src.stop(start + dur + 0.01);
}

// JUICE 04 — every SFX now routes through the ONE shared juice master limiter on
// the ONE shared juice AudioContext (see juice/audio.js), so all game audio is
// glued + limited together and can't clip when cues from both former systems
// layer. `ctx` is the juice context the callers create via getCtx() below, so
// nodes built on it connect to the same limiter. Falls back to the raw
// destination if the shared master is unavailable.
function getMaster(ctx) {
  return getJuiceMaster() || (ctx ? ctx.destination : null);
}

// Builds the sound API around a set of refs (so the returned object has a
// stable identity across renders - effects can depend on it without churning).
function createSoundApi(ctxRef, mutedRef, sizzleRef) {
  // JUICE 04 — use the ONE shared juice AudioContext (lazily created/resumed on
  // first gesture by the juice singleton) instead of a second private context.
  // ctxRef is retained only for API compatibility; it's no longer the owner, so
  // the hook must NOT close this context on unmount (the juice layer owns it).
  function getCtx() {
    return getJuiceCtx();
  }

  return {
    // Create/resume the context inside a user gesture so audio is allowed.
    unlock() {
      getCtx();
    },

    // Soft percussive key tick. Fires on every character typed, so it's kept
    // VERY quiet (peak 0.045 - well under click/tick/ding) with a fast ~25ms
    // decay, and its pitch jitters a little per press so rapid typing doesn't
    // sound robotic. Routes through the master limiter like every other SFX.
    keystroke() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420 + Math.random() * 150, now); // per-key jitter
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(MIX.keystroke, now + 0.002); // quietest cue, fast attack
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025); // short percussive tick
        osc.connect(gain).connect(getMaster(ctx));
        osc.start(now);
        osc.stop(now + 0.03);
      } catch {
        /* never let audio crash the game */
      }
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
        // Pitch rises with urgency + a small per-tick jitter so the once-a-second
        // tick doesn't machine-gun on a flat pitch.
        osc.frequency.setValueAtTime(600 + u * 600 + Math.random() * 40, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(MIX.tick, now + 0.005); // 5ms attack (trimmed level)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03); // 25ms release
        osc.connect(gain).connect(getMaster(ctx));
        osc.start(now);
        osc.stop(now + 0.035);
      } catch {
        /* never let audio crash the game */
      }
    },

    // Final-5s heartbeat: a physical low "lub-dub" thud, fired faster and faster
    // by the call site as the clutch closes in (the bomb timer is shared, so
    // everyone's pulse pounds). Two enveloped low sine thumps - a stronger "lub"
    // then a softer "dub" ~130ms later - each pitch-dropping for body. `intensity`
    // (0..1) scales loudness so the beats hit harder as the seconds run out.
    heartbeat(intensity = 0) {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const i = Math.max(0, Math.min(1, intensity));
        // One low thud: a sine that snaps in and drops in pitch (chest-thump body).
        const thud = (start, freq, peak) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * 1.7, start); // higher "knock" attack
          osc.frequency.exponentialRampToValueAtTime(freq, start + 0.06); // settle low
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(peak, start + 0.008); // hard snap in
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16); // short tail
          osc.connect(gain).connect(getMaster(ctx));
          osc.start(start);
          osc.stop(start + 0.18);
        };
        const lub = MIX.heartbeatLub * (0.9 + i * 0.5); // scales up as the clutch closes
        thud(now, 58, lub); // "lub"
        thud(now + 0.13, 46, lub * 0.7); // softer, lower "dub"
      } catch {
        /* never let audio crash the game */
      }
    },

    // Accepted word: a two-tone rising chime (880Hz -> 1320Hz, a musical fifth).
    // TRIANGLE (arcade family) so it's a sibling of the Word Bomb validCue, not a
    // different-game pure-sine ding.
    correctDing() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playTone(ctx, { freq: 880, type: 'triangle', start: now, dur: 0.08, peak: MIX.accept });
        playTone(ctx, { freq: 1320, type: 'triangle', start: now + 0.11, dur: 0.12, peak: MIX.accept });
      } catch {
        /* no-op */
      }
    },

    // Combo blip - a short bright up-chirp whose pitch CLIMBS with the streak
    // length (clamped), so each hit in a chain rings a little higher. Kept subtle
    // (it stacks over correctDing) and routes through the master limiter. Purely a
    // hype cue - tied to the local player's own streak, nothing server-side.
    combo(count = 1) {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const dest = getMaster(ctx);
        const n = Math.max(1, Math.min(12, count));
        const base = 440 + (n - 1) * 52; // ~440Hz -> ~1012Hz across the tiers
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.07); // quick chirp up
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(MIX.combo, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain).connect(dest);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch {
        /* no-op */
      }
    },

    // Combo lost - a descending "shatter": a downward saw sweep + a short noise
    // crack, so dropping a streak stings. Routes through the master limiter.
    comboBreak() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const dest = getMaster(ctx);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.28); // tumble down
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(MIX.comboBreak, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain).connect(dest);
        osc.start(now);
        osc.stop(now + 0.32);
        playNoise(ctx, { start: now, dur: 0.12, peak: MIX.comboBreak }); // glassy crack (routes to master)
      } catch {
        /* no-op */
      }
    },

    // Clutch accent - a light, bright two-blip sparkle for a buzzer-beater save.
    // Deliberately HIGH and quiet so it sits on top of correctDing/combo without
    // muddying them; only fired on the hottest near-miss tier. Master-limited.
    clutchPing() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const dest = getMaster(ctx);
        const ping = (start, freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(MIX.clutchPing, start + 0.005); // light
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
          osc.connect(gain).connect(dest);
          osc.start(start);
          osc.stop(start + 0.14);
        };
        ping(now, 1600);
        ping(now + 0.08, 2100); // a quick up-step sparkle
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
        gain.gain.linearRampToValueAtTime(MIX.wrongBuzz, now + 0.01); // quick attack (softened)
        gain.gain.setValueAtTime(MIX.wrongBuzz, now + 0.12); // sustain
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15); // quick release
        osc.connect(gain).connect(getMaster(ctx));
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
        playNoise(ctx, { start: now, dur: 0.4, peak: MIX.explosion });
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        gain.gain.setValueAtTime(MIX.explosion, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain).connect(getMaster(ctx));
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
        gain.gain.linearRampToValueAtTime(MIX.skip, now + 0.01); // quick attack
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2); // out by 200ms
        osc.connect(gain).connect(getMaster(ctx));
        osc.start(now);
        osc.stop(now + 0.22);
      } catch {
        /* no-op */
      }
    },

    // ---- App-wide UI / transition / outcome sounds ----

    // Cartoony "BONK!" impact for the "TYPE FAST" / "DIE SLOW" slams, the
    // imposter reveal and the splash - Looney-Tunes/FNF, not movie-trailer.
    // Five stacked layers feeding a compressor + makeup gain so it still hits
    // LOUD and glued, but the timbre is comic, not cinematic:
    //   1. a rounded pitched "bonk" (triangle, fast 520->130Hz drop),
    //   2. a springy "boing" tail (triangle with a settling vibrato wobble) -
    //      the signature cartoon element,
    //   3. a short slappy midrange "smack" (bandpassed noise ~1.2kHz),
    //   4. a light low thump for a bit of weight (no deep cinematic sub),
    //   5. a quick "pop" on the very attack for bite.
    punch() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;

        // Bus: everything -> compressor -> makeup gain -> out. The compressor
        // glues the layers and lets the makeup push perceived loudness/punch.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-22, now);
        comp.knee.setValueAtTime(6, now);
        comp.ratio.setValueAtTime(7, now);
        comp.attack.setValueAtTime(0.002, now);
        comp.release.setValueAtTime(0.1, now);
        const master = ctx.createGain();
        master.gain.setValueAtTime(JUICE.PUNCH_MAKEUP, now); // makeup - LOUD cartoon slam (trimmed)
        comp.connect(master).connect(getMaster(ctx));

        // 1. "Bonk": a rounded triangle with a fast, comic pitch drop - the
        // classic cartoon-punch donk.
        const bonk = ctx.createOscillator();
        const bonkGain = ctx.createGain();
        bonk.type = 'triangle';
        bonk.frequency.setValueAtTime(520, now);
        bonk.frequency.exponentialRampToValueAtTime(130, now + 0.05);
        bonkGain.gain.setValueAtTime(0.0001, now);
        bonkGain.gain.exponentialRampToValueAtTime(1.0, now + 0.004); // snap attack
        bonkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        bonk.connect(bonkGain).connect(comp);
        bonk.start(now);
        bonk.stop(now + 0.18);

        // 2. "Boing": a triangle whose pitch slides down WHILE a sine LFO wobbles
        // it (vibrato), with the wobble depth settling to zero - that springy
        // cartoon "bo-o-oing" tail. The LFO adds to the base frequency ramp.
        const boing = ctx.createOscillator();
        const boingGain = ctx.createGain();
        boing.type = 'triangle';
        boing.frequency.setValueAtTime(320, now);
        boing.frequency.exponentialRampToValueAtTime(150, now + 0.22);
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(17, now); // wobble speed
        lfoGain.gain.setValueAtTime(78, now); // wobble depth (Hz) - springier boi-oing
        lfoGain.gain.linearRampToValueAtTime(0, now + 0.22); // spring settles
        lfo.connect(lfoGain).connect(boing.frequency);
        boingGain.gain.setValueAtTime(0.0001, now);
        boingGain.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
        boingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        boing.connect(boingGain).connect(comp);
        boing.start(now);
        boing.stop(now + 0.28);
        lfo.start(now);
        lfo.stop(now + 0.28);

        // 3. "Smack": short BANDpassed noise centred in the midrange - a slappy
        // comic thwack rather than a crisp cinematic crack.
        const dur = 0.045;
        const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1200, now);
        bp.Q.setValueAtTime(0.8, now);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.62, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        noise.connect(bp).connect(noiseGain).connect(comp);
        noise.start(now);
        noise.stop(now + dur + 0.01);

        // 4. Light low thump: a touch of weight so it still lands as a hit -
        // deliberately NOT the deep 36Hz cinematic sub.
        const thump = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(140, now);
        thump.frequency.exponentialRampToValueAtTime(60, now + 0.1);
        thumpGain.gain.setValueAtTime(0.0001, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.62, now + 0.005);
        thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        thump.connect(thumpGain).connect(comp);
        thump.start(now);
        thump.stop(now + 0.16);

        // 5. "Pop" on the attack: a quick triangle blip for a little cartoon bite.
        const pop = ctx.createOscillator();
        const popGain = ctx.createGain();
        pop.type = 'triangle';
        pop.frequency.setValueAtTime(900, now);
        pop.frequency.exponentialRampToValueAtTime(400, now + 0.02);
        popGain.gain.setValueAtTime(0.0001, now);
        popGain.gain.linearRampToValueAtTime(0.3, now + 0.002);
        popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        pop.connect(popGain).connect(comp);
        pop.start(now);
        pop.stop(now + 0.035);
      } catch {
        /* no-op */
      }
    },

    // Player joined the lobby: a bright, friendly two-blip "bloop-bleep" arrival
    // pop (C5 -> G5 on triangles), fired as the new player's chip slams into the
    // roster. Quick and cheerful so a busy lobby filling up feels exciting, not
    // naggy. Routes through the master limiter like every other SFX.
    playerJoin() {
      if (mutedRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        playTone(ctx, { freq: 523.25, type: 'triangle', start: now, dur: 0.09, peak: MIX.playerJoin }); // C5
        playTone(ctx, { freq: 783.99, type: 'triangle', start: now + 0.08, dur: 0.13, peak: MIX.playerJoin }); // G5
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
        osc.frequency.setValueAtTime(1000 + Math.random() * 60, now); // tiny jitter on rapid presses
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(MIX.click, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        osc.connect(gain).connect(getMaster(ctx));
        osc.start(now);
        osc.stop(now + 0.02);
      } catch {
        /* no-op */
      }
    },

    // Transition swoosh: bandpassed white noise (centred 2kHz, Q 1) with a FAST
    // ~25ms attack then a 250ms tail - a snappy whoosh under a screen wipe. The
    // attack is deliberately short so the swipe sound lands WITH the visual slash
    // (a slower swell-in read as the sound lagging the blade).
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
        gain.gain.linearRampToValueAtTime(MIX.whoosh, now + 0.025); // fast attack - lands with the slash
        gain.gain.linearRampToValueAtTime(0.0001, now + 0.3); // out
        src.connect(filter).connect(gain).connect(getMaster(ctx));
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
        playTone(ctx, { freq: 660, type: 'sine', start: ctx.currentTime, dur: 0.03, peak: MIX.hover });
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
          playTone(ctx, { freq: 880, type: 'triangle', start: now, dur: 0.2, peak: MIX.countdownGo });
        } else {
          playTone(ctx, { freq: 440, type: 'triangle', start: now, dur: 0.1, peak: MIX.countdown });
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
        gain.gain.setValueAtTime(MIX.ko, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain).connect(getMaster(ctx));
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
        nGain.gain.setValueAtTime(MIX.ko * 0.55, t); // metallic clang, under the body
        nGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        nSrc.connect(filt).connect(nGain).connect(getMaster(ctx));
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
        playTone(ctx, { freq: 523.25, type: 'triangle', start: now, dur: 0.15, peak: MIX.victory }); // C5
        playTone(ctx, { freq: 659.25, type: 'triangle', start: now + 0.15, dur: 0.15, peak: MIX.victory }); // E5
        playTone(ctx, { freq: 783.99, type: 'triangle', start: now + 0.3, dur: 0.3, peak: MIX.victory }); // G5
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
        playTone(ctx, { freq: 400, type: 'triangle', start: now, dur: 0.2, peak: MIX.defeat });
        playTone(ctx, { freq: 200, type: 'triangle', start: now + 0.2, dur: 0.4, peak: MIX.defeat });
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
              playNoise(ctx, { start: ctx.currentTime, dur: 0.01, peak: MIX.sizzle });
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

  // Tear down on unmount: stop the sizzle loop ONLY. The AudioContext is now the
  // shared juice singleton (owned by the juice layer, used app-wide), so we must
  // NOT close it here — doing so would kill all juice/particle/results audio too.
  useEffect(() => {
    return () => {
      try {
        apiRef.current?.stopSizzle();
      } catch {
        /* no-op */
      }
    };
  }, []);

  return apiRef.current;
}
