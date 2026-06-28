// src/juice/config.js
// Single tunable home for the Word Bomb in-game juice values (from the approved
// prototype). Imported by the Word Bomb call sites in GameScreen + the combo
// valid cue in audio.js. Pure data, no logic, no side effects — tweak freely.
export const JUICE = {
  // Keystroke floating-letter rise-fade. DEFAULT OFF: at fast typing it gets
  // noisy. Flip to true to A/B it on preview (one-line, Word Bomb only).
  FLOATERS: false,

  // VALID word (Word Bomb accept). combo = the player's current streak count.
  VALID: {
    particleBase: 24, // burst count at combo 0
    particlePerCombo: 6, // + per combo step
    particleSpeed: 300,
    particleLife: 0.8,
    ringBase: 120, // shockwave radius at combo 0
    ringPerCombo: 10,
    ringWidth: 4,
    ringLife: 0.5,
    ringColor: '#2EFFE0', // teal
    flash: 0.18, // full-screen white flash alpha
    flashColor: '#FFFFFF',
    cuePitchBase: 480, // valid cue base pitch (Hz)
    cuePitchPerCombo: 45,
    colors: ['#2EFFE0', '#FFE94A', '#FFFFFF', '#3DA8FF'], // teal/yellow/white/blue
    inputFlash: '#2EFFE0', // teal border flash on the input
  },

  // INVALID word (Word Bomb reject). Layered ON TOP of the existing input-shake
  // + wrongBuzz (those stay); we only add the red flash + a small screen shake.
  INVALID: {
    flash: 0.12,
    flashColor: '#FF2E2E',
    shake: 3,
  },

  // EXPLOSION (Word Bomb KO / elimination). VISUALS ONLY — the existing
  // hitStop(120), ExplosionLayer, sound.explosion()/ko() and vibrate already
  // fire; we only enrich the canvas FX so nothing double-fires.
  EXPLOSION: {
    particles: 90,
    particleSpeed: 460,
    particleLife: 1.0,
    flash: 0.85, // big white flash alpha
    flashColor: '#FFFFFF',
    colors: ['#FF6B3D', '#FFE94A', '#FF2E2E', '#FFFFFF'], // orange/yellow/red/white
    ringYellow: { color: '#FFE94A', radius: 200, width: 6, life: 0.55 },
    ringOrange: { color: '#FF6B3D', radius: 280, width: 5, life: 0.6 },
  },

  // KEYSTROKE floating letter (only used when FLOATERS = true).
  KEY: {
    floaterRise: -64, // px/s upward velocity
    floaterLife: 0.7,
    floaterSize: 22,
    floaterColor: '#2EFFE0',
  },
};
