// useMusicPlayer.js
// Manages a single looping HTML5 <audio> element for background music
// (LEMMiNO - Firecracker). The element is created once and lives for the app's
// lifetime; the hook exposes simple controls. Nothing autoplays - browsers block
// audio until a user gesture, so App kicks off play() on the first click.

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_VOLUME = 0.3;

export function useMusicPlayer() {
  const audioRef = useRef(null);
  // The "intended" (unmuted) volume. setVolume updates this and, when not muted,
  // applies it live; toggleMute restores from it. Kept in a ref so the callbacks
  // can stay stable (no re-creation on volume changes).
  const volumeRef = useRef(DEFAULT_VOLUME);
  // Mirror of isMuted readable inside the stable callbacks without re-creating
  // them on every mute toggle.
  const mutedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Create the audio element once.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    const audio = new Audio('/firecracker.mp3');
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = 'auto';
    audioRef.current = audio;
  }

  // Tear down on unmount so we never leak a playing element.
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.pause();
        } catch {
          /* no-op */
        }
        audioRef.current = null;
      }
    };
  }, []);

  // Start playback. Browsers reject play() outside a user gesture, so the
  // promise rejection is swallowed - the caller wires this to a real click.
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      // Autoplay blocked (no gesture yet) - stay silent and try again later.
      setIsPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
    } catch {
      /* no-op */
    }
    setIsPlaying(false);
  }, []);

  // Set the intended volume. Applies immediately unless currently muted (then
  // the level is just remembered, to be restored on unmute).
  const setVolume = useCallback((v) => {
    const clamped = Math.max(0, Math.min(1, v));
    volumeRef.current = clamped;
    const audio = audioRef.current;
    if (audio && !mutedRef.current) {
      audio.volume = clamped;
    }
  }, []);

  // Mute -> volume 0; unmute -> restore the remembered intended volume.
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    const audio = audioRef.current;
    if (audio) audio.volume = next ? 0 : volumeRef.current;
    setIsMuted(next);
  }, []);

  return { play, pause, setVolume, isPlaying, isMuted, toggleMute };
}
