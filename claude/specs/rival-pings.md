# RIVAL PINGS (menu)

Status: **in progress** on another branch. This is the reference spec it should match. All
file:line refs are origin/main @ 15ece21c.
Flag: `flagOn('rival')`, i.e. `?rival=1` / localStorage `taw.flag.rival = '1'`, using the helper
from PR #170.

## Research

| Game | What it does | Lesson |
|------|--------------|--------|
| Strava | The "Uh oh! Tom just stole your KOM!" / "Dethroned!" email names the person and the segment. Riders plan their next ride to win it back. [Singletrack: "uh oh" messages](https://singletrackworld.com/forum/off-topic/just-got-one-of-those-uh-oh-messages/) · [Fit Is a Feminist Issue: losing QOMs](https://fitisafeministissue.com/2020/07/26/losing-the-last-of-my-london-qoms/) | A named person beats a number. It works because the place can be won back. |
| Duolingo Leagues | Pushes like "You're out of the top 5", plus a friend passing your weekly XP. Leagues raised lesson completion by about 25%. [Deconstructor of Fun: Leagues](https://duolingo.deconstructoroffun.com/mechanics/leagues) · [Deconstructor of Fun: Notifications](https://duolingo.deconstructoroffun.com/mechanics/notifications) | Tie the ping to a rank the player already cares about. The ping only points back at the hook. |
| Strava (anti-pattern) | People get pinged about KOMs they never knew they held, which reads as noise. [Singletrack: losing a KOM you didn't know you had](https://singletrackworld.com/forum/bike-forum/losing-a-kom-you-didnt-know-you-had/) | Only ping about a place the player actually saw and can win back. |

## Copy

- Title (big, Bungee): `XAVI PASSED YOU`
- Sub, one line, every number through `formatNum`:
  - `#5 → #6 · 2 LV BEHIND` when the passer is above you by ≥ 1 level
  - `#5 → #6 · LEVEL-TIED · MORE WORDS TAKE IT` when tied (same wording as `boardTarget.js:33`)
- Screen reader: `XAVI passed you on the leaderboard: number 5 to number 6.`
- Names are already filtered by the DB and the client (`nameFilter.js`).

## Where (joins an existing cluster, no orphan fixed UI)

- The EXISTING `RankUpMoment` card (`src/leaderboard/RankUpMoment.jsx:21`) gets a
  `kind="passed"` prop. It keeps the same podium glyph and the same 2,200 ms finite card
  (`RANKUP_MS`, `menuMoments.js:21`). The only changes are the copy and the colour: the rank number
  goes orange `#FF6B3D` instead of yellow.
- It plays through the ONE moments queue. Add `rival` to `MENU_MOMENTS` (`menuMoments.js:30`):
  `{ priority: PRIORITY.INFO, ms: RANKUP_MS, maxMs: RANKUP_MS + CHUNK_SLACK_MS + 800 }`.
  At INFO it waits behind wall, tier-up, rebirth, rank-up and claim moments.
- The persistent reminder is the trophy's existing news dot (`Homepage.jsx:1154`). Tapping the
  trophy opens the board. There's no new button.

## Trigger

- The menu-mount chain already exists: `submitStats(true) → checkRankUp(epoch)` (`Homepage.jsx:978-981`).
  `applyRankCheck` (`client.js:581`) stores the new rank and returns null on a drop.
- Change: return `{ from, to, dropped: true }` on a drop, and only when every guard below passes.
- On a drop, make ONE extra GET for the row directly above me:
  `leaderboard?select=rank,username,level&rank=eq.${to-1}`. It's the same REST view and headers as
  `fetchMyRank` (`client.js:511`).

## Guards (fairness + don't overdo it)

| Guard | Value | Why |
|-------|-------|-----|
| Claimed players only | `getMyProfile()` `client.js:108` | Unclaimed players have no rank. |
| Skip own-rebirth drops | store `taw.lb.lastRb` next to `taw.lb.lastRank`; skip if `getRebirths()` rose | The board orders by `level desc, lifetime_words desc` (`017_board_reality.sql:141`), and a rebirth resets level to 1 (`xp.js:329`). Without this guard, every rebirth fires a fake "passed you". |
| Catchable gap | passer ≤ **5 LV** above me | A stranger 40 levels up is noise. |
| Board region | my new rank ≤ **50** | That's where names mean something. Below #50, the trophy dot is enough. |
| Drop size | `to - from` ≤ **3** | A bigger drop means many people passed me; naming one of them is misleading. |
| Rate | ≤ **1 per menu visit**, ≤ **3 per local day** (`taw.lb.rivalDay = {day, n}`) | Duolingo-style pings fatigue fast. |
| No repeat | skip if the passer's username equals `taw.lb.lastPasser` | Same person twice in a row reads as nagging. |
| Weekly board | not in v1 | Week resets would drop everyone every Monday. |

## Numbers

- Card: 2,200 ms, finite, transform/opacity only, no new infinite animation (CLAUDE.md budget).
- Network: +1 GET only on a qualifying drop. Expect ≤ 3/day/player, about 200 bytes each.
- Ticker: none. Do NOT `announceTick` a pass; only rises tick (`Homepage.jsx:996`).
- **Economy impact: none.** Pays nothing and claims nothing.

## Simplest version

The REST check at menu mount only, which is already running. No realtime "you were just passed"
mid-game. A live `tick` kind `'pass'` on the broadcast channel (`live.js:156`) stays a later option.

## Risks

- **Rebirth false-positive.** This is the main bug risk; the guard above must have a unit test in
  `client.test` (rebirth between two checks gives no ping).
- **Race with the board opening.** Reuse the epoch check in `checkRankUp` (`client.js:573`) so an
  opened board drops a late ping.
- **v11 changes what the board ranks.** If v11 moves the board off LEVEL, the `LV BEHIND` copy must
  follow `targetLine` (`boardTarget.js:31`). Keep the sub-line built by the same helper, not a copy.
- **Tier.** It touches `Homepage.jsx` effects and `client.js`, not App.jsx WS, so it's Tier 2.
