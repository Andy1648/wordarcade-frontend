# T8 Summary — UI juice, mobile, and dead-state polish

All work is on `feat/blitz-bot-ui` in the frontend repo. Build (`npm run build`) verified green
after every change. `npm run lint` was already broken repo-wide before T8 started (missing ESLint
config while another session was mid-edit in package.json) and was left alone. A subagent code
review of every change ran at the end; its one real finding (homepage clipping risk) was fixed in
the last commit.

## Phase 0 — map (commit 0f7947d)
`T8-UI_NOTES.md`: full inventory of all 28 screens/states a player can see, what juice each
already had, and where the real gaps were. Key insight: Word Bomb and Category Blitz were already
heavily juiced (KO slams, heart shatter, hitlag, clutch callouts, per-second ticks, heartbeats);
the actual neglect was concentrated in Imposter Word, the connection-lost overlay, and a handful
of small touch targets.

## Phase 1 — juice

### Imposter Word audio parity (landed inside commit 8eb67ea)
- **Before:** the answering and voting phases were completely silent — no timer sound, no
  feedback sound on a submitted answer. The other two modes tick every second with rising
  urgency, thud an accelerating heartbeat in the last 5s, and ding/buzz every result.
- **After:** identical treatment, mirroring the Category Blitz implementation exactly
  (decrement-only ticks so the 3-2-1 countdown and phase resets stay silent; heartbeat cadence
  650ms→250ms over the last 5s; correctDing/wrongBuzz per answer result).
- **Attribution note:** T4 committed the whole file while this change sat in the shared working
  tree, so these hunks ride inside T4's commit 8eb67ea rather than a [T8] commit. The code is
  live and reviewed; only the commit label is off.

### Imposter Word submit + vote feedback (commit 59fb4be)
- **Before:** an accepted/rejected answer produced only a small text toast; locking in a vote was
  a bare click sound with no visual response.
- **After:** the input flashes teal with a spark burst on accept, flashes red on reject (shared
  `src/juice` toolkit — self-gated on reduced-motion and mute); voting punches (sound) and
  flashes the accused player's card in their colour.

## Phase 2 — mobile

### 44px tap targets (commits c346415 + e729d0f)
- **Before:** `mobile_audit.md` (another session's audit) flagged 4 sub-44px touch targets. Three
  (`.iw-vote-btn`, room mode/difficulty toggles, `.cb-reroll-btn`) had already been fixed by the
  time T8 got there; the two credits text links remained (~20px and ~26px hit areas).
- **After:** `.credits-link` is a 44px-tall inline-flex box; `.homepage-credits-link` gets its
  44px floor **phone-only** (≤760px, where the homepage is scrollable) after review caught that a
  flat padding bump risked clipping the height-locked one-screen desktop homepage on short
  laptops. Visual size of both links unchanged.
- Also verified (no change needed): all inputs ≥16px (no iOS zoom), no horizontal overflow,
  rotation survives via the resize-driven `--app-scale` recompute + scrollable app container,
  keyboard-over-input is handled by the browser scrolling the focused input within `.app-scroll`.

## Phase 3 — dead states

### CONNECTION LOST lands like a knockout (commit 8308e17)
- **Before:** the mid-game socket-drop overlay was the flattest surface in the app: inline
  styles, static text appearing with no motion and no sound.
- **After:** the title slams in with the game's elimination language (scale punch + tilt), the
  panicking mascot + copy + button rise in staggered underneath, and a defeat sting + heavy
  screen jolt fire once at the moment of the drop. Reduced-motion cuts straight to the static
  layout. Recovery path (BACK TO MENU → goHome) untouched. Bonus: another session immediately
  reused the new `.connlost-*` classes for its ROOM CLOSED overlay, so both terminal states now
  share one treatment.

### Waiting-for-host line breathes (commit 2009ae6)
- **Before:** non-hosts stared at a frozen "WAITING FOR HOST TO START THE GAME..." string — the
  last static waiting state in the room screen (the under-count state already had a pulsing cue
  and a bored mascot).
- **After:** same soft opacity breathing as the existing waiting cue, with the same
  reduced-motion opt-out.

### Already-good states left alone (deliberately)
Eliminated players already get a spectator banner, emoji quick-reacts, and the live game; the
empty public-rooms list already has a loading pulse and a "start the party" CTA; the empty room
already has the bored mascot. No changes needed — documented in T8-UI_NOTES.md.

## Phase 4 — verification
- `npm run build` green after every commit (final bundle 679KB / 221KB gzip, pre-existing
  chunk-size warning unrelated to T8).
- Subagent review of all changes: hook ordering, double-fire risk, stale closures, heartbeat
  cleanup, fixed-position vs `zoom` interactions, reduced-motion coverage, Mascot props, keyframe
  reuse — all verified clean; the single LOW finding (homepage clip risk) was fixed in e729d0f.

## Commits (this branch, T8)
- 0f7947d docs: UI notes — full screen/state inventory + polish plan
- (inside 8eb67ea) juice: Imposter Word audio parity
- 59fb4be juice: Imposter Word submit + vote feedback
- c346415 mobile: 44px tap targets for the credits links
- 8308e17 polish: CONNECTION LOST lands like a knockout
- 2009ae6 polish: breathe the non-host waiting line
- e729d0f mobile: scope the homepage credits-link tap floor to phones
