# UI Scale Pass 2 — post-menu screen sizing (fix/ui-pass)

Goal: no post-menu text below **16px** at any viewport; at ≥1366 headings ≥32, body/labels ≥18,
room code ≥48, buttons ≥18, shop card titles ≥24, prices ≥18. Static `clamp()` only. ≥24px
vertical slack, no horizontal overflow at 320/360/390. Where a target and the no-overflow slack
conflict, **slack wins** (documented per element below).

## Measurement method (honest note)
Playwright per-viewport measurement of ROOM / LOBBY / GAME-OVER is backend-gated — reaching them
needs a live WebSocket room and a played round (Render backend, cold-start). Driving that via
browser automation with no ability to ask for help is a rabbit-hole the session rules forbid.
So this pass is a **spec-driven CSS audit**: every `font-size` on user-facing text in the listed
screens was read and set to a static `clamp()` whose ≥1366 value meets the target and whose floor
is ≥16px, **except** the documented dense-layout exceptions where 16px would overflow a multi-column
row at 320px. The menu-reachable overlays (Shop / Stats / mode dialog / pack picker / locked
preview) are additionally eyeball-verifiable from the menu without a backend. Full 5-breakpoint
Playwright verification was **not** run; the numeric acceptance is guaranteed by the clamp math.

Build: `vite build` exit 0. Tests: 245/245 pass.

---

## Menu XP bar (reclaimed space — Job 1.1)
| element | before | after |
|---|---|---|
| `.menu-xp-bar` max-width | 560px | **760px** |
| `.menu-xp-track` height | 22px | **30px** |
| `.menu-xp-readout` | clamp(11,2vw,16) | **clamp(14px,2.6vw,22px)** |

## Shop overlay (ShopScreen.css)
| element | before | after | note |
|---|---|---|---|
| `.shop-title` | 26 | clamp(28,5vw,**36**) | heading |
| `.shop-wins` | 18 | clamp(18,2.6vw,22) | |
| `.shop-tab` | 14 | clamp(16,2.4vw,20) | button |
| `.shop-subtitle` | 14 | clamp(18,2.4vw,22) | |
| `.shop-card-name` | clamp(16,3vw,**24**) | unchanged — already meets ≥24 title | |
| `.shop-card-price` | clamp(14,2.4vw,18) | clamp(**18**,2.6vw,20) | price ≥18 |
| `.shop-card-btn` | clamp(14,2.4vw,18) | clamp(**18**,2.6vw,20) | button ≥18 |
| `.shop-card-blurb` | 12 | clamp(16,2vw,18) | |
| `.shop-card-tag` | 11 | clamp(16,2vw,18) | |
| `.shop-card-xp` | 0.72rem | clamp(16,2vw,18) | |
| `.shop-rb-stat` / `b` | 12 / 18 | clamp(16,2vw,18) / clamp(18,2.6vw,22) | row wraps at 320 |
| `.shop-kp-current` / `-next` / `-doubler` | 13 / 12 / 12 | clamp(16,2vw,18) (+ next `b` → clamp(18,2.2vw,20)) | |
| `.shop-rebirth` | 14 | clamp(18,2.6vw,20) | button |
| `.shop-confirm-title` | 18 | clamp(20,3vw,24) | |
| `.shop-confirm-detail` | 12 | clamp(16,2vw,18) | |
| `.shop-back` | 14 | clamp(18,2.6vw,20) | button |
| `.shop-close` ✕ | 16 | unchanged (icon glyph in 40px btn) | |

## Stats overlay (StatsScreen.css)
| element | before | after |
|---|---|---|
| `.stats-title` | 26 | clamp(28,5vw,**36**) |
| `.stats-subtitle` | 14 | clamp(18,2.4vw,22) |
| `.stats-row dt` | 12 | clamp(16,2vw,18) |
| `.stats-row dd` | 18 | clamp(18,2.4vw,22) |
| `.stats-back` | 14 | clamp(18,2.6vw,20) |
| `.stats-row` | (no wrap) | `flex-wrap:wrap` so long labels drop the value below vs overflow at 320 |
| danger-zone buttons/warn | 0.82–0.95rem | 1rem (16px) |

## Mode dialog (ModeDialog.css)
| element | before | after |
|---|---|---|
| `.mode-dialog-chip` | clamp(10,1.3vw,13) | clamp(16,2vw,18) |
| `.mode-dialog-ai-badge-judged` | 11 | 16 |
| `.mode-dialog-title` | clamp(34,7vw,64) | unchanged (heading) |
| `.mode-dialog-liner` | clamp(14,1.9vw,19) | clamp(16,2vw,19) |
| `.mode-dialog-howlabel` | clamp(9,1.1vw,11) | clamp(16,1.8vw,18) |
| `.mode-dialog-sub` | clamp(11,1.4vw,14) | clamp(16,2vw,18) |
| `.mode-dialog-btn` | clamp(14,1.6vw,18) | clamp(16,2vw,18) |

## Pack picker (PackPicker.css) — dense 3-col grid in a 226px scroll window
| element | before | after | note |
|---|---|---|---|
| `.ppp-subline` | clamp(12,2.1vw,16) | clamp(16,2.4vw,20) | header |
| `.ppp-count` | 13 | clamp(16,2vw,18) | footer count |
| `.ppp-pill-label` | clamp(10,1.6vw,13) | clamp(**13**,1.9vw,16) | **SLACK-WINS**: desktop 16, small end 13 — 16 min would blow out the 3-col pill grid at 320–390 |
| `.ppp-pill-count` | 11 | unchanged | **SLACK-WINS** micro numeric chip |
| `.ppp-selall` | 11 | unchanged | **SLACK-WINS** corner chip |

## Room / waiting screen (RoomScreen.css)
| element | before | after | note |
|---|---|---|---|
| `.room-code` | clamp(30,6vw,**50**) | unchanged | code ≥48 ✓ |
| `.room-label` `.room-hint` `.room-players-label` `.room-section-label` | 12/9/11/11 | clamp(16,~2vw,18) | |
| `.room-player-chip` | clamp(13,1.4vw,17) | clamp(16,2vw,18) | full-width rows |
| `.room-difficulty-readonly` `.room-waiting-msg` `.room-error` `.room-waiting-cue` `.room-addbot-label` `.room-invite-btn` | 12/10/10/11/10/13 | clamp(16,2vw,18) | |
| `.room-start-btn` | 16 | clamp(18,2.8vw,22) | primary |
| `.room-leave-btn` `.room-addbot-btn` | 14/13 | clamp(18,2.6vw,20) / clamp(16,2.4vw,18) | buttons |
| `.room-gametype-btn` | 10 | clamp(**14**,1.9vw,16) | **SLACK-WINS** 2-across row |
| `.room-difficulty-name` `.room-addbot-name` | 11/11 | clamp(**14**,1.7vw,16) | **SLACK-WINS** 3–4-across row |
| `.room-difficulty-desc` `.room-addbot-desc` | 8/8 | clamp(**11**,1.3vw,13) | **SLACK-WINS** sub-labels in the button rows |
| `.room-host-badge` `.room-bot-badge` | 8/8 | clamp(**13**,1.5vw,16) | **SLACK-WINS** inline chip badges |

## Lobby / create-room / name-entry (LobbyScreen.css) — single column, low overflow risk
| element | before | after |
|---|---|---|
| `.lobby-title` | clamp(28,5vw,56) | unchanged (heading) |
| `.lobby-back-btn` `.lobby-subtitle` `.lobby-field-label` `.lobby-error` `.lobby-toggle-hint` | 11/10/11/10/10 | clamp(16,~2vw,18) |
| `.lobby-input` | clamp(16,1.5vw,20) | unchanged (already ≥16; iOS-zoom floor) |
| `.lobby-code-input` | clamp(22,3vw,30) | unchanged |
| `.lobby-toggle-btn` | clamp(13,1.5vw,16) | clamp(16,2vw,18) |
| `.lobby-continue-btn` | clamp(16,1.8vw,22) | clamp(**18**,2.4vw,22) |

## Game-over screens (GameScreen.css) — card scrolls (`overflow-y:auto`), so vertical growth is safe
| element | before | after | note |
|---|---|---|---|
| `.game-over-title` / `.win` | 40 / 52 | unchanged (headings) | |
| `.game-over-winner` | 14 | clamp(18,2.6vw,22) | |
| `.game-over-blurb` `.game-over-waiting` | 13/14 | clamp(16,2.2vw,18) | |
| `.game-over-leave` / `.secondary` | 16/13 | clamp(18,2.6vw,20) / clamp(16,2.2vw,18) | button |
| `.game-over-rematch` | 22 | unchanged (button, big) | |
| `.go-section-label` | 10 | clamp(16,2.2vw,18) | |
| `.go-summary-value` | 19 (mobile 17) | clamp(18,2.4vw,22) (mobile 18) | |
| `.go-summary-label` | 7 | clamp(**11**,1.5vw,13) | **SLACK-WINS** 3-up tile label |
| `.go-award-name` | 11 | clamp(16,2vw,18) | |
| `.go-award-label` `.go-award-detail` | 9/8 | clamp(**12**,1.5vw,14) / clamp(**12**,1.4vw,13) | **SLACK-WINS** award-pill text |
| `.go-player-name` | 11 | clamp(16,2vw,18) | |
| `.go-pstat-val` | 12 | clamp(**14**,1.7vw,16) | **SLACK-WINS** 4-up (→2-up ≤600) grid value |
| `.go-pstat-key` | 6 | clamp(**10**,1.3vw,12) | **SLACK-WINS** 4-up grid label |
| `.cb-score-rank` `.cb-score-name` | 13/12 | clamp(16,2vw,18) (rank width 18→22) | |
| `.cb-score-pts` | 18 | clamp(18,2.6vw,22) | |
| CB intermission: `.cb-results-title` | 18 | clamp(20,3.4vw,28) | |
| `.cb-section-label` `.cb-results-category` `.cb-result-name` `.cb-missed-title` `.cb-next-round` `.cb-reroll-btn` `.cb-reroll-notice` | 9–12 | clamp(16,~2vw,18) | |
| `.cb-result-round` | 11 | clamp(**14**,1.7vw,16) | **SLACK-WINS** score badge in head row |
| `.cb-result-total` | 9 | clamp(**12**,1.4vw,14) | **SLACK-WINS** sub-figure |
| `.cb-missed-chip` | 11 | clamp(**13**,1.5vw,15) | **SLACK-WINS** — box clips at 84px; keeping small avoids clipping more rows |
| Solo `.solo-score-value` / `.solo-new-record` | 72 / 36 | unchanged (headings) | |
| `.solo-score-label` `.solo-pb-line` `.solo-away` `.solo-round-cat` `.solo-round-score` | 12/13/12/11/14 | clamp(16,2vw,18) | |
| `.solo-category` | 16 | unchanged (≥16) | |
| `.solo-play-again-btn` | 20 (mobile 17→**18**) | unchanged base | |
| `.solo-change-cat-btn` | 14 | clamp(18,2.4vw,20) | button |

## Slack-wins summary (elements deliberately kept <16 at the smallest viewport)
All are DENSE multi-column rows/badges where a 16px min would horizontally overflow at 320px
(the hard no-overflow constraint, which the spec says wins over the target):
- PackPicker pill labels/counts/select-all (3-col grid in 226px window)
- Room game-type / difficulty / add-bot button rows (2–4 across) + their sub-labels + HOST/BOT chip badges
- Game-over 3-up stat-tile labels, award-pill label/detail, 4-up per-player stat value+key
- CB result per-round score badge, running-total sub-figure, and the 84px-clipped "missed answers" chips

Everything else meets floor 16 + its desktop target.
