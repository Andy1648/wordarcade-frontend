// rollSounds.js — the ROLL screen's event sounds (Andy oct5). Same voice family + toggle as
// gameSounds.js; they live here, not there, because gameSounds is in the homepage's eager chunk and
// only the lazy roll screen (Reel.jsx) plays these — so they ride its chunk (e2e/payload-budget ratchet).
import { tone, pentFreq, NOTE } from './audioCore.js';
import { ready } from './gameSounds.js';

// ---- ROLL SCREEN (Andy oct5) --------------------------------------------------------------
// reel tick — one tiny click per mark passing the line. The reel slows, so the ticks slow with it.
// `rank` is the passing mark's tier (0 COMMON … 5 SECRET): a rarer mark clicks a step higher, so the
// sound tells the same truth the strip shows. Very short + quiet: it fires up to ~30×/s at full speed.
export function sndReelTick(rank = 0) {
  const ctx = ready();
  if (!ctx) return;
  const deg = Math.min(NOTE.C6, NOTE.G4 + Math.max(0, Math.min(5, Math.floor(rank))));
  tone(ctx.currentTime, { freq: pentFreq(deg), type: 'triangle', dur: 0.035, gain: 0.07, attack: 0.002, lowpass: 2400 });
}

// build-up swell — EPIC+ only, starts with the dim as the reel enters its last cells and rises until the land.
// Finite (one oscillator pair, `durMs` long); rarer = a lower start, a higher climb, a little louder.
const SWELL = { epic: [NOTE.G3, NOTE.G4, 0.06], legendary: [NOTE.Eb3, NOTE.C5, 0.075], mythic: [NOTE.C3, NOTE.Eb5, 0.085], secret: [NOTE.C3, NOTE.G5, 0.095] };
export function sndRollSwell(tier = 'epic', durMs = 1000) {
  const ctx = ready();
  const sw = SWELL[tier];
  if (!ctx || !sw) return;
  const t = ctx.currentTime;
  const dur = Math.max(0.2, durMs / 1000);
  tone(t, { freq: pentFreq(sw[0]), glideTo: pentFreq(sw[1]), type: 'sawtooth', dur, gain: sw[2], attack: dur * 0.9, lowpass: 1400 });
  tone(t, { freq: pentFreq(sw[0]) / 2, glideTo: pentFreq(sw[1]) / 2, type: 'sine', dur, gain: sw[2] * 1.2, attack: dur * 0.9 });
}

// the cutscene "1 IN X" stamp hit — a low thump + a bright clang, bigger for rarer tiers (LEGENDARY+)
export function sndCutStamp(tier = 'legendary') {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const big = tier === 'mythic' || tier === 'secret';
  tone(t, { freq: 110, glideTo: 46, type: 'sine', dur: big ? 0.5 : 0.36, gain: big ? 0.3 : 0.24, attack: 0.003, lowpass: 600 });
  tone(t, { freq: pentFreq(NOTE.C5), type: 'square', dur: 0.12, gain: 0.07, attack: 0.002, lowpass: 3200 });
  if (tier === 'secret') tone(t + 0.06, { freq: pentFreq(NOTE.G5), type: 'triangle', dur: 0.3, gain: 0.1, attack: 0.003 });
}

// rarity sting — plays as the reel lands; scales with the tier. COMMON one soft note; RARE a two-note lift;
// EPIC a struck chord; LEGENDARY a run into a chord; MYTHIC adds a low swell under it; SECRET climbs two octaves.
const STING = {
  common: [[NOTE.C5]],
  rare: [[NOTE.G4], [NOTE.C5]],
  epic: [[NOTE.C4, NOTE.G4, NOTE.C5]],
  legendary: [[NOTE.G4], [NOTE.Bb4], [NOTE.C5, NOTE.G5]],
  mythic: [[NOTE.Eb4], [NOTE.G4], [NOTE.Bb4], [NOTE.C5, NOTE.G5, NOTE.C6]],
  secret: [[NOTE.C4], [NOTE.Eb4], [NOTE.G4], [NOTE.C5], [NOTE.Eb5], [NOTE.G5], [NOTE.C5, NOTE.G5, NOTE.C6]],
};
export function sndRollSting(tier = 'common') {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const steps = STING[tier] || STING.common;
  const heavy = tier === 'legendary' || tier === 'mythic' || tier === 'secret';
  const gap = heavy ? 0.085 : 0.07;
  steps.forEach((chord, i) => {
    const last = i === steps.length - 1;
    chord.forEach((deg, j) => tone(t + i * gap, {
      freq: pentFreq(deg),
      type: j === 0 ? 'triangle' : 'sine',
      dur: last ? (heavy ? 0.6 : 0.22) : 0.1,
      gain: (last ? 0.16 : 0.13) / (j ? 1.4 : 1),
      attack: 0.004,
    }));
  });
  if (tier === 'mythic' || tier === 'secret') {
    // a low root swell under the chord — the "something big just happened" floor
    tone(t, { freq: pentFreq(NOTE.C3), type: 'sine', dur: 0.9, gain: 0.14, attack: 0.08, lowpass: 500 });
  }
}
