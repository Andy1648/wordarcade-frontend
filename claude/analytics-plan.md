# Analytics plan — progression funnel instrumentation (feat/analytics)

Both sinks are wired: **PostHog** (`track()` → `posthog.capture`, lazy-loaded) and **GA4** (gtag.js in
`index.html`, `G-BZ7DLWLDMR`). One centralized layer routes every event to both:
- `src/lib/analytics.js` — `track` (both sinks), `trackOnce` (localStorage-gated milestones),
  `setSessionProps` (PostHog super-props + GA4 user_properties).
- `src/lib/events.js` — the canonical event catalog: one named helper per event, so call sites are
  one-liners and names/payloads live in one place.

**Privacy:** every payload is ENUMS + COUNTS only — no PII, no player name, and **never keystroke /
word content**. `mode` is a fixed id. All helpers are fire-and-forget and guarded; with no key they are
silent no-ops.

## Session properties (attached to every event, so events segment by progression stage)
Set at boot (after init) and refreshed on level-up / rebirth / streak-day:
| property | source | segments by |
|---|---|---|
| `level` | current XP level | how far along the player is |
| `rebirth_count` | rebirths done | prestige depth |
| `streak` | daily-streak count | habit strength |

## Events

| event | fires when… | question it answers | where |
|---|---|---|---|
| `first_visit` | the very first session ever (once, gated) | how many NEW players arrive | `main.jsx` (after init) |
| `splash_dismissed` | the TYPE/TAP-TO-START gate is cleared | how many get past the front door | `SplashScreen.dismiss()` |
| `mode_opened` | a mode dialog opens (`{mode}`) | which modes draw interest | `Homepage` card→dialog |
| `locked_mode_clicked` | a still-locked mode's preview is opened (`{mode, unlock_level}`) | demand for gated modes → is the gate too high? | `Homepage.handleLockedSelect` |
| `round_started` | a solo run begins (`{mode, kind:'solo'}`) — first run + every restart | do openers become players? restart appetite | `useSoloGame` (CHAIN/FUSE) |
| `round_completed` | a solo run ends (`{mode, score, words}`) | completion rate + score distribution | `useSoloGame.endRun` |
| `level_up` | any level-up (`{level}`) | progression velocity + where players stall | `useXpCapture` |
| `first_wins_earned` | the first-ever payout (once, `{amount}`) | do players reach the economy at all | `Homepage` winsHint gate |
| `shop_opened` | the SHOP overlay opens (not the rebirth view) | shop discovery rate | `ShopScreen` mount |
| `item_purchased` | any purchase commits (`{item, tier}`) — cosmetics, KEY POWER, WORD SENSE, MOMENTUM, themes | what players actually spend on | `ShopScreen` buy handlers |
| `rebirth` | a rebirth is confirmed (`{count}`) | who reaches prestige, and how often | `ShopScreen.confirmRebirth` |
| `streak_day` | first menu load of an active streak day (`{count}`, once/day) | day-N retention curve | `Homepage` mount |
| `share_copied` | a result card is copied (`{surface}`) | virality / share intent | `CopyResultButton` |
| `secret_found` | a hidden/secret achievement is newly earned (`{id}`) | discovery of the game's easter-eggs | `App` achievements check |

## The funnel it reconstructs
`first_visit → splash_dismissed → mode_opened → round_started → round_completed → first_wins_earned →
level_up (×N) → shop_opened → item_purchased → rebirth`, with `streak_day` measuring return retention
and `share_copied` / `secret_found` measuring depth of engagement. Every step carries the session props,
so each drop-off is sliceable by level / rebirth / streak.

## Coverage notes (honest scope)
- `round_started` / `round_completed` currently cover **CHAIN + FUSE** (the shared `useSoloGame` hook).
  **SAT Rush** (its own `useSatRushGame` hook) and **multiplayer Word Bomb / Category Blitz** (their
  rounds live in App.jsx WebSocket handlers, TIER-1) are the documented follow-up — instrumenting the
  WS handlers wants the supervised Tier-1 workflow, so it was left out of this additive pass. `mode_opened`
  already captures intent for every mode including those.
- `result_copied` (a pre-existing event) is kept as-is; `share_copied` is added alongside it as the
  canonical funnel name.
