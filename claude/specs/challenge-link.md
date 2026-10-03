# CHALLENGE LINK (race a friend's ghost)

Status: dormant. All file:line refs are origin/main @ 15ece21c (frontend) and the backend at
`chain-reaction-backend/` working copy.
Flag: `flagOn('challenge')`, i.e. `?challenge=1` / localStorage `taw.flag.challenge = '1'`. The
flag gates the SENDER button only. A received link always works, so a friend who doesn't have the
flag on isn't stranded.

## Research

| Game | What it does | Lesson |
|------|--------------|--------|
| GeoGuessr challenge links | One link gives everyone the exact same rounds. They play whenever they like and compare on a shared result. The friend just picks a nickname. [TechWiser: play GeoGuessr with friends](https://techwiser.com/play-geoguessr-with-friends/) · [WebFactory: GeoGuessr multiplayer](https://www.webfactoryltd.com/how-to-make-a-geoguessr-map-multiplayer/) | Async works if the link lands IN the game, with no signup. |
| Mario Kart 8 ghosts | You download a friend's Time Trial run and race it as a ghost that can't touch you. [Giant Bomb: Mario Kart 8](https://www.giantbomb.com/games/3030-42929/) · [Mario Wiki: Ghost](https://mario.fandom.com/wiki/Ghost_(Mario_Kart_series)) | A visible ghost beats a number. A number is the fallback. |
| Wordle share grid | It shares a spoiler-free brag. Wardle deliberately left the link out because it "would have looked trashy". [Smithsonian](https://www.smithsonianmag.com/smart-news/heres-why-the-word-game-wordle-went-viral-180979439/) · [Boston.com / NYT](https://www.boston.com/news/national-news/2022/01/04/he-made-wordle-for-his-partner-now-its-an-online-hit/) | Short, spoiler-free text. Our link is the point, so keep it to the end and keep the text tiny. |

## State today (why this is the biggest of the six)

- **There's no result-share button anywhere.** fix/econ-perf-attack deleted the share-card pipeline
  as unused (`src/share/links.js:6-9`). `buildResultCard` (`share/resultCard.js:104`) has no caller.
- **The race has no deep link.** `PATH_TO_QUERY` (`router.js:50-61`) has no `/race/play`.
- **Bots ignore a requested pace.** Whole-word race bots type at a fixed `BOT_MS_PER_CHAR = 300`
  (backend `wordRace.js:389`). So "race a bot at your friend's pace" needs a backend change. v1
  doesn't do it.
- The race launches from `App.jsx:2253` `send('race_quick_match', …)`. That's **Tier 1**. A receiver
  route has to use the existing launch path; it can't add a new one.

## Copy

- Sender button (race results card, under `.wr-standings`, `WordRaceScreen.jsx:312`):
  `CHALLENGE A FRIEND` (≥ 44 px, the same button style as PLAY AGAIN).
- Shared text (spoiler-free, no words, every number through `formatNum`):
  `TYPE A WORD · RACE · 25 WORDS IN 41.2s · BEAT ME →` + link
- Receiver HUD chip (in the race header, next to the existing goal text): `BEAT XAVI: 41.2s`
- Receiver end line (in `.wr-over-why`, `WordRaceScreen.jsx:305`):
  `YOU BEAT XAVI BY 3.2s` / `XAVI WINS BY 1.1s`, plus a button `SEND IT BACK` (the same share call).
- Name: `getMyProfile().username` (`client.js:108`) if claimed, else `A FRIEND`. Already filtered.

## Where (no orphan fixed UI)

- The sender sits in the results card's button group.
- The receiver chip sits in the race HUD row.
- The verdict replaces the `.wr-over-why` line.
- There's no new screen and nothing fixed.

## Trigger / link format

- `navigator.share({ text, url })`, falling back to `navigator.clipboard.writeText` with a `COPIED`
  label swap. It's the same pattern as `RoomScreen.jsx:161-176`.
- URL: `/race/play?vs=<name>&t=<ms>&n=<words>`.
  - `vs`: at most 16 chars, URL-encoded, re-filtered on read.
  - `t`: integer ms, clamped to 5,000-600,000.
  - `n`: the race target, an integer 5-100.
- **v1 doesn't send splits** (the ghost lane is v2). Three params keep the link short (< 80 chars).
- Receiver: add `'/race/play': 'race=1'` to `PATH_TO_QUERY` (`router.js`), and `LAUNCH_INTENT`
  starts the existing quick match. `vs/t/n` are stashed in sessionStorage `taw.challenge` at boot and
  cleared at the race's end.
  - **This touches the App launch path (Tier 1).** It needs a supervised diff and the 2-device
    checklist. The exact App.jsx diff: read `LAUNCH_INTENT.play === 'race'` in the same branch that
    handles `play=word-bomb`, and call the existing quick-match handler at `:2253` once the socket
    is open.

## Data

| Need | Source |
|------|--------|
| my finish time | race `goAt` (server time converted, `raceState.js`) to my last accepted word's local time; record it in the reducer (pure, `raceState.js:32`). `recordPace` (`racePace.js:26`) keeps only ms/word. |
| race target | `target` already in `WordRaceScreen.jsx` (`FIRST TO N WORDS`, `:306`) |
| challenge | sessionStorage `taw.challenge = { vs, t, n }` |

## Numbers

| Knob | Value |
|------|-------|
| params | 3 (`vs`, `t`, `n`) |
| time precision shown | 0.1 s |
| clamp | 5-600 s, 5-100 words |
| challenge expires | when the tab closes (sessionStorage), or after 1 race |
| if `n` ≠ this race's target | show `BEAT XAVI: 25 WORDS IN 41.2s` and compare by **words per second** (`n/t` vs mine). The verdict says `YOU WERE FASTER` / `XAVI WAS FASTER`. |
| buttons added | 1 (sender) + 1 (SEND IT BACK, same handler) |

**Economy impact: none.** The ghost or target is display only. It's never in `standings`, never a
`winnerId`, and **never counts as a human rival** for the winner bonus (`winnerPayout`,
`payout.js:239`). Race pay is unchanged, so no sim is needed. Tampering only makes the friend's
target harder or easier; it pays nothing.

## Simplest version (v1)

- Sender button, a 3-param link, the receiver chip and the verdict line.
- No ghost lane and no backend change.

v2 (only if v1 links get used, measured by a PostHog `challenge_open` event):
- add `g=<base36 splits>` and one local, translucent `XAVI'S RUN` lane in `.wr-lanes`
  (`WordRaceScreen.jsx:190`), driven from `goAt`.

## Risks

- **Tier 1 launch path.** A broken `/race/play` boot strands a cold visitor. Gate it with the 2-device
  checklist, and add an e2e for a cold `/race/play?vs=X&t=41200&n=25` (CI runs it).
- **Vercel landing shadow.** There's no `public/race/` landing page today, so `/race/play` falls
  through to the SPA. Confirm with the `cold-visitor-deep-link` check, because vite preview and
  Vercel disagree.
- **Unfair comparisons.** The friend may get a different word list or bot field. That's acceptable:
  the target is words-per-time and it's labelled as
  their time.
- **Share surface was cut as unused once.** Track `challenge_share` / `challenge_open`. If opens are
  under about 5% of shares after 2 weeks, cut it again (#2).
