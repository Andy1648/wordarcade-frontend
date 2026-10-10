// rollSounds.js — the ROLL screen's event sounds (Andy oct5). Same voice family + toggle as
// gameSounds.js; they live here, not there, because gameSounds is in the homepage's eager chunk and
// only the lazy roll screen (Reel.jsx) plays these — so they ride its chunk (e2e/payload-budget ratchet).
import { tone, pentFreq, NOTE } from './audioCore.js';
import { ready } from './gameSounds.js';

// ---- ROLL SCREEN (Andy oct5) --------------------------------------------------------------
// reel tick — one tiny click per mark passing the line. The reel slows, so the ticks slow with it.
// `rank` is the passing mark's tier (0 RARE … 4 SECRET): a rarer mark clicks a step higher, so the
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

// ---- HOLD TO ROLL (NIGHT oct8 R4) --------------------------------------------------------------
// the charge — one rising tone for the length of the hold ("sound effects rise in pitch just before the reveal");
// finite: it ends with the charge. A cancel (released early) gets one dull low blip.
export function sndRollCharge(durMs = 500) {
  const ctx = ready();
  if (!ctx) return;
  const dur = Math.max(0.1, durMs / 1000);
  tone(ctx.currentTime, { freq: pentFreq(NOTE.C4), glideTo: pentFreq(NOTE.C6), type: 'triangle', dur, gain: 0.07, attack: 0.01, lowpass: 2200 });
}
export function sndRollCancel() {
  const ctx = ready();
  if (!ctx) return;
  tone(ctx.currentTime, { freq: 180, glideTo: 90, type: 'square', dur: 0.09, gain: 0.05, attack: 0.002, lowpass: 900 });
}
// the release — the slingshot lets go: a short down-whip + a bright tick as the reel starts
export function sndRollRelease() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, { freq: pentFreq(NOTE.C6), glideTo: pentFreq(NOTE.C4), type: 'sawtooth', dur: 0.16, gain: 0.08, attack: 0.002, lowpass: 3000 });
  tone(t, { freq: pentFreq(NOTE.G5), type: 'triangle', dur: 0.06, gain: 0.06, attack: 0.002 });
}
// RE-ARM (R4 step 7): the slab is ready again — two quick soft notes, up (the "next one?" nudge)
export function sndRollReady() {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, { freq: pentFreq(NOTE.G4), type: 'triangle', dur: 0.06, gain: 0.05, attack: 0.003 });
  tone(t + 0.07, { freq: pentFreq(NOTE.C5), type: 'triangle', dur: 0.09, gain: 0.06, attack: 0.003 });
}
// THE TELL's rumble (LEGENDARY+ only): a low floor under the colour, rising until the land — finite, `durMs` long
export function sndRollTell(tier = 'legendary', durMs = 700) {
  const ctx = ready();
  if (!ctx) return;
  const dur = Math.max(0.2, durMs / 1000);
  const big = tier === 'mythic' || tier === 'secret';
  tone(ctx.currentTime, { freq: 42, glideTo: big ? 70 : 58, type: 'sine', dur, gain: big ? 0.26 : 0.2, attack: dur * 0.6, lowpass: 240 });
}
// the LEGENDARY+ shard burst on the full reveal: a fast scatter of high ticks (one per shard, staggered)
export function sndShardBurst(tier = 'legendary') {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const n = tier === 'secret' ? 9 : tier === 'mythic' ? 7 : 6;
  for (let i = 0; i < n; i += 1) {
    tone(t + i * 0.028, { freq: pentFreq(NOTE.C6 + (i % 3)), type: 'triangle', dur: 0.05, gain: 0.05, attack: 0.001, lowpass: 5000 });
  }
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

// rarity sting — plays as the reel lands; scales with the tier. RARE a two-note lift;
// EPIC a struck chord; LEGENDARY a run into a chord; MYTHIC adds a low swell under it; SECRET climbs two octaves.
const STING = {
  rare: [[NOTE.G4], [NOTE.C5]],
  epic: [[NOTE.C4, NOTE.G4, NOTE.C5]],
  legendary: [[NOTE.G4], [NOTE.Bb4], [NOTE.C5, NOTE.G5]],
  mythic: [[NOTE.Eb4], [NOTE.G4], [NOTE.Bb4], [NOTE.C5, NOTE.G5, NOTE.C6]],
  secret: [[NOTE.C4], [NOTE.Eb4], [NOTE.G4], [NOTE.C5], [NOTE.Eb5], [NOTE.G5], [NOTE.C5, NOTE.G5, NOTE.C6]],
};
export function sndRollSting(tier = 'rare') {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const steps = STING[tier] || STING.rare;
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

// ---- ROLL REVEAL v2 (the card flip + its escalation) -------------------------------------------
// the flip — a short "thwip" as the card turns; a slam tier (LEGENDARY+) adds a low thump under it
export function sndRevealFlip(tier = 'rare') {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, { freq: pentFreq(NOTE.C6), glideTo: pentFreq(NOTE.G4), type: 'triangle', dur: 0.07, gain: 0.06, attack: 0.002, lowpass: 3600 });
  if (tier === 'legendary' || tier === 'mythic' || tier === 'secret') {
    tone(t + 0.12, { freq: 96, glideTo: 44, type: 'sine', dur: 0.28, gain: 0.22, attack: 0.003, lowpass: 500 });
  }
}
// the rising sting under the pre-flip beat (EPIC's rattle, the LEGENDARY+ telegraph, the SECRET spin-up): one finite
// climb, `durMs` long — rarer = a lower start and a higher top
const RISE = { epic: [NOTE.G3, NOTE.C5, 0.05], legendary: [NOTE.Eb3, NOTE.G5, 0.06], mythic: [NOTE.C3, NOTE.Bb5, 0.07], secret: [NOTE.C3, NOTE.C6, 0.08] };
export function sndRevealRise(tier = 'epic', durMs = 600) {
  const ctx = ready();
  const r = RISE[tier];
  if (!ctx || !r) return;
  const t = ctx.currentTime;
  const dur = Math.max(0.15, durMs / 1000);
  tone(t, { freq: pentFreq(r[0]), glideTo: pentFreq(r[1]), type: 'triangle', dur, gain: r[2], attack: dur * 0.85, lowpass: 2600 });
  tone(t, { freq: pentFreq(r[0]) * 1.007, glideTo: pentFreq(r[1]) * 1.007, type: 'sawtooth', dur, gain: r[2] * 0.4, attack: dur * 0.9, lowpass: 1200 });
}
// the land's arpeggio (RARE+): a twinkle → a chime → a rising run; rarer = more steps, higher
const ARP = {
  rare: [NOTE.C5, NOTE.G5],
  epic: [NOTE.G4, NOTE.C5, NOTE.G5],
  legendary: [NOTE.C4, NOTE.G4, NOTE.C5, NOTE.Eb5, NOTE.G5],
  mythic: [NOTE.C4, NOTE.Eb4, NOTE.G4, NOTE.C5, NOTE.Eb5, NOTE.G5],
  secret: [NOTE.C3, NOTE.G3, NOTE.C4, NOTE.G4, NOTE.C5, NOTE.G5, NOTE.C6],
};
export function sndRevealArp(tier = 'rare') {
  const ctx = ready();
  const steps = ARP[tier];
  if (!ctx || !steps) return;
  const t = ctx.currentTime;
  const gap = steps.length > 4 ? 0.055 : 0.07;
  steps.forEach((deg, i) => {
    const last = i === steps.length - 1;
    tone(t + i * gap, { freq: pentFreq(deg), type: 'triangle', dur: last ? 0.45 : 0.12, gain: last ? 0.11 : 0.08, attack: 0.003, lowpass: 5200 });
  });
}
// one tick per stat line of the stats extension — each a step higher
export function sndStatTick(i = 0) {
  const ctx = ready();
  if (!ctx) return;
  tone(ctx.currentTime, { freq: pentFreq(Math.min(NOTE.C6, NOTE.G4 + i)), type: 'square', dur: 0.04, gain: 0.035, attack: 0.002, lowpass: 2800 });
}
