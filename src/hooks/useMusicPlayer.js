// useMusicPlayer.js
// Manages a single looping HTML5 <audio> element for background music
// (LEMMiNO - Firecracker) plus a Web Audio analysis graph for beat sync.
//
// Graph (built once on first play):
//   MediaElementSource --> AnalyserNode            (analysis tap, full amplitude)
//                      \-> GainNode --> destination (audible output, volume here)
//
// Volume/mute/duck are applied on the GAIN node, not the element, so the
// analyser always sees the track at full amplitude even while the music is
// quiet (0.3) or ducked in-game (0.15). That's what makes the beat sync punchy.

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_VOLUME = 0.3;

export function useMusicPlayer() {
  const audioRef = useRef(null);
  // The "intended" (unmuted) volume. setVolume updates this; toggleMute restores
  // from it. In a ref so the callbacks stay stable across volume changes.
  const volumeRef = useRef(DEFAULT_VOLUME);
  // Mirror of isMuted readable inside the stable callbacks.
  const mutedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Web Audio analysis pipeline, built lazily on first play. All optional - if
  // Web Audio is unavailable the music still plays (volume falls back to the
  // element), just without reactive animations.
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);
  const freqRef = useRef(null);

  // Create the audio element once.
  if (audioRef.current === null && typeof Audio !== 'undefined') {
    const audio = new Audio('/firecracker.mp3');
    audio.loop = true;
    audio.volume = DEFAULT_VOLUME; // used until the gain node takes over
    audio.preload = 'auto';
    audioRef.current = audio;
  }

  // Push the current intended/muted volume to wherever loudness is controlled:
  // the gain node once the graph exists, otherwise the bare element.
  const applyVolume = useCallback(() => {
    const desired = mutedRef.current ? 0 : volumeRef.current;
    if (gainRef.current) {
      gainRef.current.gain.value = desired;
    } else if (audioRef.current) {
      audioRef.current.volume = desired;
    }
  }, []);

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

  // Build the AudioContext + analyser + gain once (a MediaElementSource can only
  // be created once per element) and resume the context. Safe to call again.
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
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        // Low smoothing keeps kick transients sharp (frame-to-frame), which the
        // onset/delta beat detection in useBeatSync relies on.
        analyser.smoothingTimeConstant = 0.4;
        const gain = ctx.createGain();
        gain.gain.value = mutedRef.current ? 0 : volumeRef.current;
        // Analyser is a pre-gain tap (full amplitude); gain feeds the speakers.
        source.connect(analyser);
        source.connect(gain);
        gain.connect(ctx.destination);
        // The element is now full-volume; the gain node owns loudness.
        audio.volume = 1;
        sourceRef.current = source;
        analyserRef.current = analyser;
        gainRef.current = gain;
        freqRef.current = new Uint8Array(analyser.frequencyBinCount);
      }
    } catch {
      // Analysis is optional - never let it break playback.
    }
  }, []);

  // Live frequency snapshot, all bands normalized 0..1 (byte value / 255).
  // kick: bins 0-2 (sub-bass, where kick-drum transients live - used for beat
  // detection, narrower than bass so it ignores bass-guitar/synth notes);
  // bass: bins 0-4; mid: 5-15 (vocals); high: 16-30 (hats); overall: all.
  const getFrequencyData = useCallback(() => {
    const analyser = analyserRef.current;
    const arr = freqRef.current;
    if (!analyser || !arr) return { kick: 0, bass: 0, mid: 0, high: 0, overall: 0 };
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
    return {
      kick: band(0, 2),
      bass: band(0, 4),
      mid: band(5, 15),
      high: band(16, 30),
      overall,
    };
  }, []);

  // Start playback. Browsers reject play() outside a user gesture, so the
  // promise rejection is swallowed - the caller wires this to a real click.
  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Wire up the analyser graph on first play (within the gesture that allows
    // audio), then push volume to whichever node now owns it.
    ensureAnalyser();
    applyVolume();
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      // Autoplay blocked (no gesture yet) - stay silent and try again later.
      setIsPlaying(false);
    }
  }, [ensureAnalyser, applyVolume]);

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

  // Set the intended volume (applies immediately unless muted, in which case the
  // level is remembered and restored on unmute).
  const setVolume = useCallback(
    (v) => {
      volumeRef.current = Math.max(0, Math.min(1, v));
      applyVolume();
    },
    [applyVolume]
  );

  // Mute -> 0; unmute -> restore the remembered intended volume.
  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    applyVolume();
    setIsMuted(mutedRef.current);
  }, [applyVolume]);

  return { play, pause, setVolume, isPlaying, isMuted, toggleMute, getFrequencyData };
}
