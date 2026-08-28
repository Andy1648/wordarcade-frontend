# JOB 11 — SOUND DESIGN PASS (feat/sound)

A small, coherent, fully-synthesized sound set (zero asset files, Web Audio, same approach as
clack.js). One voice family, C MINOR PENTATONIC (C, Eb, F, G, Bb) — pentatonic can't form a
dissonant chord, so overlaps are always safe. Up = good, down = bad, higher = more.

## Architecture
- `audio/audioCore.js` — ONE AudioContext + ONE master chain (masterGain → compressor → destination),
  shared by BOTH the keystroke clack and the event sounds. Pentatonic frequency ladder; a 14-voice
  cap culling the oldest; master volume (persisted `taw.audioVolume`); ctx re-checked on
  `visibilitychange` (iOS re-suspends); latencyHint default ('interactive'); never created before a
  user gesture; never throws.
- `audio/gameSounds.js` — the 10 events, each fire-and-forget (checks toggle → ensures ctx → schedules
  at `currentTime` → returns; never awaited, never blocks the input path).
- `progress/clack.js` — refactored onto the shared master chain (so the volume slider + voice cap
  cover keystrokes), with the §2 fatigue fixes.
- `components/AudioControls.jsx` — the 🔊 event-sound toggle + master-volume slider (⌨ clack and ♫
  music toggles already existed) → THREE separate toggles.

## §2 — clack fixes (biggest fatigue win)
- **7-variant round-robin on the lowpass cutoff** (0.88–1.12×, ±12%), cycled with a no-immediate-repeat
  rule; an ODD count so it never lines up with typing rhythm. Timbre variation is the real anti-machine-gun
  lever.
- Pitch (0.94–1.06) and gain (±12%) jitter kept EXACTLY — not widened.
- Profiles differ mainly by cutoff/body: thock (lp 1800, strong body) / clack (lp 4200, weaker body) /
  cream (mid, longer smoother noise) / marble / typewriter.

## §3 — the 10 events (exact recipes)
| Event | Recipe |
|-------|--------|
| word accepted | triangle+sine at a pentatonic degree indexed by COMBO (climbs octaves), +fifth at -6dB, 5ms attack, silent by 120ms |
| word rejected | sine 155→130Hz glide, 100ms, lowpass 800Hz, quiet — not a buzzer |
| level up | 3-note ascending run G–Bb–C, ~90ms each (~350ms) |
| rebirth | 5-note run C–Eb–G–Bb–C + soft low-root swell, ≤600ms |
| purchase | two-note up-interval C→G, triangle, ~140ms |
| lucky word | 3 fast high notes G5–Bb5–C6, ~40ms, overlapped |
| danger zone | quiet low-root pulse; tempo 500→180ms + pitch C3→Eb3 rising with the clock; STOPS instantly when danger passes |
| run over | descending fall C–Bb–G, sine, ~300ms |
| streak extended | single warm F4, ~120ms |
| achievement | root+fifth+octave struck together, 200ms decay |

## §5 — defaults & control (school-lab audience)
- **Sound OFF by default** — all three toggles default OFF (clack flipped from its old default-ON;
  event sounds + music likewise). A room of Chromebooks stays silent until a student opts in.
- **Three separate toggles**: ⌨ keystroke, 🔊 event, ♫ music — keystroke has its own switch because
  typing sound is a documented misophonia trigger.
- **Master volume slider**, persisted, live.
- OFF is truly silent (no context is even created until a toggle-on gesture; every sound early-returns
  when its toggle is off — verified). No sound carries information not also on screen (accept/reject/
  level/lucky/danger/run-over all have visible counterparts).

## Measurements (Playwright, real Chromium)
- **Latency event → audible**: every sound is scheduled synchronously at `ctx.currentTime` in the same
  JS tick as the event and never awaited, so the app adds **~0ms**. Audible onset = `baseLatency`
  (measured **10.7ms** @ 48kHz) + the sound's attack (3–8ms) + platform output buffer → **≈14–19ms**
  first-audible, identical across all 10 (they share the path). The keystroke registers visually first;
  audio is scheduled, not awaited.
- **Concurrent-voice peak under a 30 keys/sec burst**: **15**, immediately culled to the **14-voice
  cap** — within the 12–16 target. (Each keystroke = press+release × (noise+body) ≈ 4 short voices,
  ~60–90ms each.)
- **Silence when off**: with toggles off, no AudioContext is created and voiceStats peak = **0** — nothing
  fires. Confirmed for each toggle independently.

## Wiring coverage (on this branch, off main)
Wired: word accepted (Word Bomb, Blitz, CHAIN, FUSE — combo-pitched), word rejected (all), level up
(menu XP), rebirth + purchase (shop), lucky word (solo), danger zone (Word Bomb clock), run over
(game + solo).
NOT wired here (the systems live on the feature-chain branches, not main): **achievement earned**
(Job 7's `checkAchievements`) and **in-game level-up** (Job 1's play-grants-XP) — `sndAchievement` /
`sndLevelUp` exist and just need one call added when those branches merge. **streak extended** is
defined (`sndStreakExtended`) but left unwired pending a decision on daily-streak vs combo-milestone.

Tests: `audio/audio.test.js` (4 — pentatonic math, volume persistence, toggle default-off). Full
suite 356 green. Build clean.
