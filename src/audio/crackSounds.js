// crackSounds.js — THE CRACK ROLL's sounds (prototype nov18). Web Audio synthesis only (CLAUDE.md: no audio files), the
// same voice + toggle as the roll screen (audioCore tone / gameSounds ready). Every rarity has its OWN register and voice:
//   RARE a dry blue click · EPIC a purple pluck · LEGENDARY a gold bell · MYTHIC a pink chime pair · SECRET a glassy square
// so you HEAR the tier the core just jumped to before you read it.
import { tone, pentFreq, NOTE } from './audioCore.js';
import { ready } from './gameSounds.js';

const VOICE = {
  rare: { deg: NOTE.C4, type: 'triangle', gain: 0.12 },
  epic: { deg: NOTE.E4, type: 'triangle', gain: 0.13 },
  legendary: { deg: NOTE.G4, type: 'sine', gain: 0.16 },
  mythic: { deg: NOTE.C5, type: 'sine', gain: 0.16 },
  secret: { deg: NOTE.E5, type: 'square', gain: 0.09 },
};
const voice = (t) => VOICE[t] || VOICE.rare;

/** A tap CRACKS the shell: a crunchy snap (a falling square blip) over a low thump; tap i (0..2) bites harder. */
export function sndCrackTap(i = 0, tier = 'rare') {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const v = voice(tier);
  tone(t, { freq: 1900 + 260 * i, glideTo: 420, type: 'square', dur: 0.07, gain: 0.07 + 0.015 * i, attack: 0.002, lowpass: 3800 });
  tone(t, { freq: 140 - 12 * i, glideTo: 70, type: 'sine', dur: 0.16, gain: 0.2 + 0.04 * i, attack: 0.003 });
  tone(t + 0.02, { freq: pentFreq(v.deg + i), type: v.type, dur: 0.12, gain: v.gain * 0.6, attack: 0.004, lowpass: 2600 });
}

/** The core JUMPS a tier: a quick rising arpeggio in the NEW tier's voice; a SKIP (two tiers) runs twice as many notes. */
export function sndCrackJump(tier = 'epic', skip = false) {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const v = voice(tier);
  const steps = skip ? [0, 2, 4, 5, 7, 9] : [0, 2, 4, 7];
  const gap = skip ? 0.045 : 0.06;
  steps.forEach((s, k) => tone(t + k * gap, { freq: pentFreq(v.deg + s), type: v.type, dur: 0.22, gain: v.gain, attack: 0.004, lowpass: 5200 }));
  // the low "whomp" under the jump: the screen punch you can hear
  tone(t, { freq: 110, glideTo: 55, type: 'sine', dur: 0.28, gain: skip ? 0.32 : 0.24, attack: 0.004 });
  if (tier === 'mythic' || tier === 'secret') tone(t + steps.length * gap, { freq: pentFreq(v.deg + 12), type: 'sine', dur: 0.5, gain: v.gain * 0.8, attack: 0.01 });
}

/** The core CLENCHES before it bursts: a short rising swell in the result's register. */
export function sndCrackCharge(tier = 'rare', durMs = 420) {
  const ctx = ready();
  if (!ctx) return;
  const t = ctx.currentTime;
  const v = voice(tier);
  const dur = Math.max(0.15, durMs / 1000);
  tone(t, { freq: pentFreq(v.deg - 5), glideTo: pentFreq(v.deg + 7), type: 'sawtooth', dur, gain: 0.06, attack: dur * 0.85, lowpass: 1600 });
  tone(t, { freq: 90, glideTo: 180, type: 'sine', dur, gain: 0.14, attack: dur * 0.85 });
}
