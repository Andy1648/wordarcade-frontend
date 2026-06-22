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

  // Web Audio analysis pipeline (audio element -> source -> analyser ->
  // destination), built lazily on first play so the beat-sync hook can read
  // live frequency data. All optional - if Web Audio is unavailable the music
  // still plays, just without reactive animations.
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const freqRef = useRef(null);

  // Create the audio element once.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    const audio = new Audio('/firecracker.mp3');
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME;
    audio.preload = 'auto';
    audioRef.current = audio;
  }

  // Tear down on unmount so we never leak a playing element / audio context.
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
      const ctx = audioCtxRef.current;
      if (ctx) {
        try {
          ctx.close();
        } catch {
          /* no-op */
        }
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Build the AudioContext + analyser once (a MediaElementSource can only be
  // created once per element), and resume the context. Safe to call repeatedly.
  const ensureAnalyser = useCallback(() => {
    try {
      const audio = audioRef.current;
      if (!audio) return;
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        sourceRef.current.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        freqRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch {
      // Analysis is optional - never let it break playback.
    }
  }, []);

  // Live frequency snapshot, all bands normalized 0..1 (byte value / 255).
  // bass: bins 0-4 (kick), mid: 5-15 (vocals), high: 16-30 (hats), overall: all.
  const getFrequencyData = useCallback(() => {
    const analyser = analyserRef.current;
    const arr = freqRef.current;
    if (!analyser || !arr) return { bass: 0, mid: 0, high: 0, overall: 0 };
    analyser.getByteFrequencyData(arr);
    const band = (start, end) => {
      let sum = 0;
      let n = 0;
      for (let i = start; i <= end && i < arr.length; i++) {
        sum += arr[i];
        n += 1;
      }
      return n ? sum / n / 255 : 0;
    };
    let total = 0;
    for (let i = 0; i < arr.length; i++) total += arr[i];
    const overall = arr.length ? total / arr.length / 255 : 0;
    return { bass: band(0, 4), mid: band(5, 15), high: band(16, 30), overall };
  }, []);

  // Start playback. Browsers reject play() outside a user gesture, so the
  // promise rejection is swallowed - the caller wires this to a real click.
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Wire up the analyser graph on first play (within the gesture that allows
    // audio), so frequency data is available while the music plays.
    ensureAnalyser();
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      // Autoplay blocked (no gesture yet) - stay silent and try again later.
      setIsPlaying(false);
    }
  }, [ensureAnalyser]);

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

  return { play, pause, setVolume, isPlaying, isMuted, toggleMute, getFrequencyData };
}
