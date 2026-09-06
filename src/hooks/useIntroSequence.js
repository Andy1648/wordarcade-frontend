// useIntroSequence.js — the loading -> splash -> fight-card intro -> knife-split lifecycle extracted
// from App.jsx (refactor/app-split-6). PURE refactor: the four presentation states + their handlers,
// moved verbatim. This is intro CHROME only — it never touches the WS drain, the room-view guard, the
// live-`view` render, or the FIFO queue. Initial state is seeded from the module-load skipIntro /
// seenIntro flags (passed in so their computation stays in App). Returns the states the render's early
// returns read + the handlers the splash/intro/knife components fire.
import { useState, useRef } from 'react';
import { markIntroSeen } from '../visitHistory';

export function useIntroSequence({ music, sound, skipIntro, seenIntro }) {
  // The bomb-fuse loading screen is the very first thing shown; it holds until
  // the socket connects (then "explodes" and hands off), at which point the
  // splash takes over. `loadingDone` flips true once that explosion finishes.
  // In a portal embed — and on ?join= / ?daily= deep links — we skip straight
  // to the menu, so the loading screen is pre-completed (the socket still
  // connects in the background via useWebSocket).
  const [loadingDone, setLoadingDone] = useState(skipIntro);

  // The splash/attract screen is shown after loading, once per session
  // (dismissing it never re-arms it). Portal embeds and deep links skip it, and
  // so do repeat visitors (seenIntro) — they go loading -> menu with no splash
  // or fight-card intro.
  const [showSplash, setShowSplash] = useState(!skipIntro && !seenIntro);
  // After the splash is dismissed we play the anime fight-card intro (TYPE FAST.
  // / DIE SLOW.) before wiping to the homepage. Shown once, between the two.
  const [showIntro, setShowIntro] = useState(false);
  // The intro -> menu KNIFE-SPLIT reveal (replaces the old explosion): true while
  // the blade-slice overlay plays over the freshly-mounted menu. Cosmetic only.
  const [slicing, setSlicing] = useState(false);
  const sliceTimerRef = useRef(null);

  // Splash: unlock audio + start the music silently within the click gesture.
  // This click is the browser's autoplay-unlock gesture, so it's where we create
  // the SFX AudioContext too. No punch here - the intro's two title lines each
  // land their own punch, so a leading hit on dismiss would just double up.
  function handleSplashStart() {
    music.setVolume(0);
    music.play();
    sound.unlock();
  }

  // Splash dismissed: hand off to the anime fight-card intro sequence (it covers
  // the screen black, so there's no flash of homepage underneath). The intro
  // calls handleIntroComplete when it's done. Music is already playing silently
  // (started in handleSplashStart on the click); it's faded up once we wipe in.
  function handleSplashDismiss() {
    setShowSplash(false);
    setShowIntro(true);
  }

  // Intro finished: drop the overlay, run the Persona-5 bar wipe down to the
  // homepage, and fade the music up DURING the wipe.
  function handleIntroComplete() {
    setShowIntro(false);
    // First visit just finished the intro — remember it so repeat visits skip
    // straight past the splash + fight-card animations (#6a).
    markIntroSeen();
    music.fadeTo(0.3, 500);
    // Reveal the menu with the KNIFE-SPLIT (this transition's signature, in place
    // of the explosion + the generic bar wipe). Under reduced motion we skip the
    // slice entirely and just cut to the menu.
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    // The blade-hit / halves-apart cues + the jolt are fired BY KnifeSplit from
    // its phase chain (onSlash/onOpen below), so each lands WITH its visual —
    // not here at handoff, which is ~920ms before the halves actually part.
    setSlicing(true);
    if (sliceTimerRef.current) clearTimeout(sliceTimerRef.current);
    // KnifeSplit drives its OWN lifecycle (~2.0s slash+hold+open, tap-to-skip,
    // same-session/reduced-motion skip) and calls onComplete (handleSliceComplete)
    // when it's done. This timer is only a safety net so the overlay can never get
    // stuck mid-screen if that callback somehow never fires.
    sliceTimerRef.current = setTimeout(() => setSlicing(false), 2500);
  }

  // KnifeSplit finished (or was skipped): tear down the overlay. Idempotent — the
  // safety timer above and this callback are both guarded by clearing the ref.
  function handleSliceComplete() {
    if (sliceTimerRef.current) {
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    setSlicing(false);
  }

  return {
    loadingDone,
    setLoadingDone,
    showSplash,
    showIntro,
    slicing,
    handleSplashStart,
    handleSplashDismiss,
    handleIntroComplete,
    handleSliceComplete,
  };
}
