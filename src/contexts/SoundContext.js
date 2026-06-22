// SoundContext.js
// App-wide access to the synthesized sound engine (see useSoundEffects) plus the
// global SFX mute state. App.jsx creates the engine once and provides it here so
// every screen - splash, homepage, lobby, room, game - can play UI / transition
// sounds and share one mute toggle (muting in-game persists everywhere). The SFX
// mute is separate from the background-music mute (MusicButton owns that).
import { createContext, useContext } from 'react';

// A safe fallback so a consumer rendered outside the provider never throws: every
// sound method becomes a no-op and the mute controls do nothing.
const noop = () => {};
const FALLBACK = {
  sound: new Proxy({}, { get: () => noop }),
  muted: false,
  setMuted: noop,
};

export const SoundContext = createContext(FALLBACK);

export function useSound() {
  return useContext(SoundContext);
}
