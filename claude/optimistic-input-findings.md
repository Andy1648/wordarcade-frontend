# JOB C — optimistic Word Bomb input: measure-first + a premise gap to resolve

Branch: `feat/optimistic-input` (TIER-1, branch-only). **Measure-first done; implementation not
started** — there's a fork in the spec's premise I want your call on first (below).

## MEASURE-FIRST (before): Enter → visible ACCEPT feedback
Mock-WS harness, WB in-game on my turn, a valid word (contains the fragment, ≥3, unused), `word_result`
pushed after a simulated RTT. In-page timing from the Enter keypress to `.wb-pending-accept`. Median of 3.
Tool: `claude/_tools/measure-optimistic.mjs`.

| simulated RTT | Enter → accept (median) | runs |
|---|---|---|
| 30 ms | **101 ms** | 104, 101, 85 |
| 150 ms | **199 ms** | 199, 200, 199 |
| 450 ms | **506 ms** | 509, 506, 496 |

**Confirmed: acceptance is round-trip-bound** — ≈ RTT + ~55 ms client overhead. At a realistic mobile
RTT (150–450 ms) you wait 0.2–0.5 s to see your own word accepted. This matches the "laggy" report and
is exactly what optimistic accept removes. (Local REJECT is already instant — the three client-known
rejects short-circuit today; this is purely about the ACCEPT confirmation waiting on the dictionary check.)

## THE PREMISE GAP (why I stopped before implementing)
The spec step 2 says: *"Validate locally on Enter (contains combo, ≥3 letters, **in the accept list**,
not already used) and show acceptance IMMEDIATELY."* But — **the Word Bomb client does not hold a
dictionary.** Grepped App/GameScreen/hooks: there is no WB word-set/accept-list loaded. WB's
`not_a_word` check is **server-only** (the client only knows length/combo/used — those three are the
existing instant-reject checks). The solo modes (CHAIN/FUSE/SAT) load their own word data, but that is
a *different* list from the server's WB dictionary. So "in the accept list" is not a check the WB client
can currently perform. That forks the implementation:

### Path A — ship the WB accept-list to the client
Optimism becomes a true local check (accept only if the word is in the shipped list). No false accepts.
- **Costs:** a payload (the WB dictionary is large), and — the real risk — **client/server dictionary
  drift.** If the shipped list and the server's diverge, the client either accepts words the server
  rejects (→ rollback anyway, no better than Path B) OR **rejects words the server accepts (a FALSE
  REJECT — strictly worse than today).** Keeping two dictionaries byte-identical across deploys is a
  standing maintenance hazard.

### Path B — optimistic-accept on the local checks + reconcile (my recommendation)
Show acceptance immediately when the word passes the checks the client *can* run (contains fragment,
≥3, not used) — i.e. **bet it's a real word** — send to the server as now, and **reconcile on
`word_result`**: if the server rejects (`not_a_word`, or a race like another player using it same-tick),
**roll back visibly and name the reason.** The server stays the single source of dictionary truth.
- **Upside:** <30 ms feedback for the common case (players type real words), no payload, **no drift
  risk**, matches "server stays authoritative; optimism is presentation only."
- **The one behaviour change to accept:** typing a genuine NON-word briefly flashes accept, then rolls
  back with a reason. Rare in WB (you're racing to type valid words), visible, and honest.

## RECOMMENDATION
**Path B.** It delivers the win the measurement proves is needed (kill the 0.2–0.5 s accept wait)
without the dictionary-drift trap that could make Path A *worse* than today (false rejects). It's also
a smaller, safer diff.

## IF YOU PICK B — the plan (TIER-1, needs your 2-device play-test before merge)
1. In `GameScreen.submit()` (WB branch): after the existing local rejects pass, set the pending chip
   straight to **`accept`** (not `flight`) + fire the accept juice, keyed so it can be un-done.
2. Track the optimistic word as "awaiting server confirm" (reuse `myOutstandingWordsRef`).
3. On `word_result` for that word: `accepted` → already shown, just clear the awaiting flag; `rejected`
   → **roll back**: flip the chip to reject, name the reason, and — crucially — **do NOT** touch score/
   turn/lives (the server never counted it; the client only un-shows its own optimistic paint).
4. Score/turn/lives stay 100% server-driven (unchanged) — the optimism only moves the *accept paint*
   earlier; reconciliation only repaints.
5. Re-measure (expect <30 ms at every RTT) + enumerate every disagreement case found.

**Awaiting your call: A or B?** Then I implement on this branch and re-measure. Nothing else changed
here yet.
