// runTimers.js — the SAT RUSH run clock is exactly two timers: the between-word
// pause (`pauseTimer`) and the stage/spell tick (`stageTimer`). `clearRunTimers`
// is the single cancel path used when a run ends — on a clean mid-run exit
// (abandon) and on unmount. Its whole job is to GUARANTEE that once a run stops,
// no already-scheduled doMiss / stage tick can still fire.
//
// It lives here as a standalone unit (not inlined in the hook) purely so that
// guarantee is directly testable with fake timers, without a DOM/React renderer:
// the hook holds the two refs and calls this; the test schedules real timeouts
// into ref-shaped objects, calls clearRunTimers, advances time, and asserts
// nothing fired. `clear` is injectable only for testing; production passes the
// default clearTimeout.
export function clearRunTimers(pauseRef, stageRef, clear = clearTimeout) {
  clear(pauseRef.current);
  clear(stageRef.current);
}
