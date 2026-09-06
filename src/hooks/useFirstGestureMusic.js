// useFirstGestureMusic.js — the first-gesture music unlock extracted from App.jsx (refactor/app-split-6).
// PURE refactor: moved verbatim. Music starts on the FIRST user gesture anywhere on the site — a
// click, key, or touch on ANY element (the splash cover, the menu, a landing page). Browsers block
// autoplay until a gesture, so this is the earliest legal moment; the listener is document-level,
// one-shot, and covers every entry path (cold splash, SEEN_INTRO repeat visitor with no splash,
// ?satrush=1 / ?join= / ?daily= deep links, and landing-page -> home). pointerdown+keydown+touchstart
// so a mouse, a key, or a bare touch all unlock it.
//
// Volume choreography differs by path and is preserved here: during the splash / fight-card intro the
// music must stay SILENT until the menu wipe (handleIntroComplete fades it up), so on a splash session
// we start at 0 and DON'T fade; every other path fades up to 0.3 immediately. splashWillShowRef is
// captured at first render so the branch is stable.
import { useRef, useEffect } from 'react';

export function useFirstGestureMusic({ sound, music, showSplash }) {
  const splashWillShowRef = useRef(showSplash);
  const firstGestureMusicRef = useRef(false);
  useEffect(() => {
    const startMusicOnGesture = () => {
      if (firstGestureMusicRef.current) return;
      firstGestureMusicRef.current = true;
      sound.unlock();
      music.setVolume(0);
      music.play();
      // Splash sessions hold the track silent until the menu wipe fades it up.
      if (!splashWillShowRef.current) music.fadeTo(0.3, 500);
      document.removeEventListener('pointerdown', startMusicOnGesture);
      document.removeEventListener('keydown', startMusicOnGesture);
      document.removeEventListener('touchstart', startMusicOnGesture);
    };
    document.addEventListener('pointerdown', startMusicOnGesture);
    document.addEventListener('keydown', startMusicOnGesture);
    document.addEventListener('touchstart', startMusicOnGesture);
    return () => {
      document.removeEventListener('pointerdown', startMusicOnGesture);
      document.removeEventListener('keydown', startMusicOnGesture);
      document.removeEventListener('touchstart', startMusicOnGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
