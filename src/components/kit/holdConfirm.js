// kit/holdConfirm.js — the HOLD-TO-CONFIRM clock (KitButtons sheet, "HOLD 1.0S").
//
//   start()  pointer / Enter / Space went down  → phase 1 (light rattle)
//   at shakeAt (550 ms)                          → phase 2 (hard rattle)
//   at holdMs (1000 ms)                          → COMMIT (onCommit), back to idle
//   end()    released early                      → CANCEL (onCancel), back to idle
//
// It commits ONLY when the full hold elapses; a release one frame early is a cancel. Pure apart from
// the injected timer + clock, so node --test drives it. Reduce motion changes nothing here — the
// hold is a confirmation, not decoration (the component drops the rattle, not the wait).

export const HOLD_MS = 1000;
export const HOLD_SHAKE_AT_MS = 550;
export const HOLD_CANCEL_MS = 180; // the fill drains back this fast on an early release

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createHoldConfirm({
  holdMs = HOLD_MS,
  shakeAt = HOLD_SHAKE_AT_MS,
  onPhase = () => {},
  onCommit = () => {},
  onCancel = () => {},
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  now = defaultNow,
} = {}) {
  let holding = false;
  let startedAt = 0;
  let tShake = null;
  let tCommit = null;

  const clear = () => {
    if (tShake !== null) clearTimer(tShake);
    if (tCommit !== null) clearTimer(tCommit);
    tShake = tCommit = null;
  };

  return {
    /** Begin a hold. Ignored while one is already running (key auto-repeat, a second pointer). */
    start() {
      if (holding) return false;
      holding = true;
      startedAt = now();
      onPhase(1);
      tShake = setTimer(() => {
        tShake = null;
        if (holding) onPhase(2);
      }, shakeAt);
      tCommit = setTimer(() => {
        tCommit = null;
        if (!holding) return;
        holding = false;
        clear();
        onPhase(0);
        onCommit();
      }, holdMs);
      return true;
    },
    /** Release. Before holdMs this is a cancel; after a commit it is a no-op. */
    end() {
      if (!holding) return false;
      holding = false;
      clear();
      onPhase(0);
      onCancel(Math.max(0, now() - startedAt));
      return true;
    },
    /** Tear down without callbacks (unmount). */
    dispose() {
      holding = false;
      clear();
    },
    get holding() {
      return holding;
    },
    /** 0..1 of the hold elapsed (0 when idle). */
    progress() {
      return holding ? Math.min(1, Math.max(0, (now() - startedAt) / holdMs)) : 0;
    },
  };
}
