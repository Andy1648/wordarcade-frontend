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
    shake: 1,
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

  // JUICE 02 — Word Bomb tension ramp. t = 1 - remainingFraction (0 calm -> 1
  // critical). Only the layers NOT already in GameScreen are here (the --danger
  // vignette, bomb rattle, heartbeat, drain and panic pose are existing and stay
  // as-is). All visuals are edge/atmosphere so the input + target letters stay
  // legible at peak. ALL numbers tunable.
  TENSION: {
    ease: 6, // how fast the displayed t eases toward the real value (per second)

    // Edge color grade: a transparent-center radial tint whose hue shifts
    // teal -> orange -> red with t and whose alpha ramps to capAlpha. Center is
    // kept clear (innerStop) so legibility is never reduced.
    colorGrade: {
      capAlpha: 0.28,
      innerStop: 0.45, // 0..1 of half-diagonal kept fully transparent
      calm: [46, 255, 224], // #2EFFE0 teal
      warn: [255, 107, 61], // #FF6B3D orange
      crit: [255, 46, 46], // #FF2E2E red
      reducedCap: 0.12, // reduced-motion keeps only this faint shift
    },

    // Edge speed lines (vertical streaks hugging the L/R edges), density + alpha
    // proportional to t. Skipped under reduced-motion.
    speedLines: {
      start: 0.45,
      maxPerSide: 7,
      color: '255, 255, 255',
      maxAlpha: 0.22,
      edgeBand: 90, // px from each edge the streaks live in
    },

    // Center-top prompt. HURRY! pulses in, becomes GET OUT! at the very end.
    prompt: {
      hurryAt: 0.6,
      getOutAt: 0.92,
      hurry: 'HURRY!',
      getOut: 'GET OUT!',
      color: '#FFE94A',
      critColor: '#FF2E2E',
      size: 34, // px (scaled up a touch by the pulse)
      pulseHz: 3,
    },

    // Final-moment cosmetic throb (NO timing change): a soft full-screen red
    // vignette breath near t -> 1. Pure opacity, reduced-motion -> faint/none.
    finalPulse: { start: 0.9, hz: 6, maxAlpha: 0.16, color: '255, 46, 46' },

    // Continuous audio voices (rumble + siren) on the shared AudioContext. The
    // heartbeat is the EXISTING sound.heartbeat (not duplicated here).
    audio: {
      rumble: { start: 0.35, baseFreq: 40, freqRise: 30, maxGain: 0.16 },
      siren: { start: 0.9, lo: 600, hi: 1000, sweepHz: 2.5, maxGain: 0.05 },
      gainEase: 4, // per-second easing of voice gains (smooth in/out)
    },
  },

  // JUICE 04 — unified SOUND MIX. One ranked level table (peak gains) for EVERY
  // cue across both audio modules, now sharing ONE AudioContext + master. Ordered
  // loudest -> quietest: impacts on top, UI/keystroke at the floor, so layered
  // cues (valid + combo + tick) sum cleanly under the shared limiter. Palette law:
  // melodic/positive = triangle, impact/body = sine + noise, ticks/UI = square,
  // negative = saw/square. Tweak here; both modules read these.
  MIX: {
    explosion: 0.42, // life lost — loudest gameplay hit
    ko: 0.34, // elimination
    stampThud: 0.3, // results stamp slam
    heartbeatLub: 0.26, // final-5s pulse (low freq, reads softer than its number)
    countdownGo: 0.26, // "GO!"
    victory: 0.22,
    fanfare: 0.22,
    accept: 0.18, // correctDing + validCue (shared accept identity)
    defeat: 0.18,
    countdown: 0.17, // 3-2-1 beeps
    wrongBuzz: 0.16,
    comboBreak: 0.16,
    playerJoin: 0.15,
    whoosh: 0.15, // wipe / open / slash family
    skip: 0.13,
    combo: 0.11,
    tick: 0.09, // per-second turn tick (was 0.15)
    clutchPing: 0.09,
    sparkle: 0.13,
    click: 0.06, // UI buttons (was 0.10)
    hover: 0.05,
    sizzle: 0.05,
    scoreTick: 0.05,
    keystroke: 0.04, // quietest — fires on every character (was 0.045)
  },
  PUNCH_MAKEUP: 1.6, // cartoon-slam makeup gain (was 2.0) — loud but less peak-hogging

  // JUICE 03 — Category Blitz SOLO results celebration. Presentational only: it
  // animates the DISPLAY of the score/new-best that the screen already computed.
  // isRecord (the existing pb.isNewRecord) is the WIN branch. Timings drive the
  // staged sequence; the count-up READS the real final score.
  CELEBRATION: {
    entranceMs: 300, // card pop .85 -> 1.02 -> 1
    stampDelay: 300, // when the stamp slams (after entrance)
    scoreDelay: 600, // when the count-up starts (after the stamp)
    countMs: 950, // count-up duration
    statStagger: 110, // ms between stat lines

    stamp: {
      shakeWin: 5, // scoped card shake amplitude
      shakeLoss: 7,
      flashWin: 0.4, // screen flash alpha
      flashLoss: 0.7,
      flashWinColor: '#FFE94A',
      flashLossColor: '#FFFFFF',
      ashCount: 40, // dark puff on a non-record finish
      ashColors: ['#3a3a3a', '#555555', '#222222', '#6b6356'],
    },

    score: {
      tickEvery: 37, // pitched tick every N counted units
      confettiCount: 120, // win-only burst at the reveal
      confettiColors: ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF', '#FFFFFF'],
      confettiSpeed: 540,
      confettiLife: 1.5,
    },
  },
};
