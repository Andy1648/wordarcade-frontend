// rushMute.js — the SOUND switch in the SAT Rush / French Rush run header (feat/french-rush-sound; a classroom of
// phones needs a way to go quiet). It is NOT a second setting: it drives the arcade's own mute — the same
// `taw.sfxEvents` flag SETTINGS → VOLUME → MUTE writes (gameSounds.js), plus the keyboard clack it also silences,
// plus the juice layer's live mute every rush cue checks. Muted also stops the review card READING THE WORD BY
// ITSELF (the 🔊 button still works — tapping it is the player asking).
//
// "On" is the rush's default: only an explicit '0' (the arcade mute) counts as off.
import { enableEventSounds, disableEventSounds } from '../audio/gameSounds.js';
import { disableClack } from '../progress/clack.js';
import { setMuted as setJuiceMuted } from '../juice/settings.js';

export const RUSH_SOUND_KEY = 'taw.sfxEvents';

/** Is the rush's sound on? Pure read of the arcade mute: anything but an explicit '0' is on. */
export function rushSoundOn() {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(RUSH_SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

/** Flip the sound (call inside the tap — turning it on creates/resumes the audio context in-gesture). */
export function setRushSound(on) {
  if (on) {
    enableEventSounds();
    setJuiceMuted(false);
  } else {
    disableEventSounds();
    disableClack();
    setJuiceMuted(true);
  }
  return rushSoundOn();
}

/** On mount: a player who muted the arcade is muted here too. Only ever MUTES (never un-mutes an app-level mute). */
export function syncRushSound() {
  if (!rushSoundOn()) setJuiceMuted(true);
}
