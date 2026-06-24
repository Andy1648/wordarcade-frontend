// friendlyError.js
// Turns raw backend error strings into short, friendly, on-brand (loud graffiti
// voice) messages so players never see a terse or technical server string. Matching
// is by keyword so it survives small wording changes on the backend. Unknown
// messages PASS THROUGH (lightly capped) rather than being swallowed - we never
// hide a real problem behind a generic line, we just make the known ones friendlier.

const RULES = [
  { match: /not found|no such room|invalid code|bad code/i, msg: 'THAT ROOM GHOSTED YOU — DOUBLE-CHECK THE CODE.' },
  { match: /full|capacity|max players/i, msg: "ROOM'S PACKED — TRY ANOTHER OR START YOUR OWN." },
  { match: /already started|in progress|underway/i, msg: 'TOO LATE — THAT GAME ALREADY KICKED OFF.' },
  { match: /name.*(taken|in use)|(taken|in use).*name|duplicate name/i, msg: 'SOMEONE GRABBED THAT NAME — PICK ANOTHER.' },
  { match: /rate|too many|slow down|cooldown/i, msg: 'WHOA, SLOW DOWN — GIVE IT A SEC AND RETRY.' },
  { match: /not host|host only|permission|not allowed/i, msg: 'ONLY THE HOST CAN DO THAT.' },
  { match: /connection|disconnect|socket|timed out|timeout/i, msg: 'LOST THE SERVER — TRY AGAIN IN A MOMENT.' },
  { match: /name.*(long|short|invalid)|invalid name/i, msg: "THAT NAME WON'T FLY — TRY A DIFFERENT ONE." },
];

/**
 * @param {string} raw - the backend's error message (or any thrown string).
 * @returns {string} a friendly, presentable message - never empty.
 */
export function friendlyError(raw) {
  const text = (raw || '').toString().trim();
  if (!text) return 'SOMETHING GLITCHED — GIVE IT ANOTHER SHOT.';
  for (const r of RULES) {
    if (r.match.test(text)) return r.msg;
  }
  // Unknown message: surface it (so real issues aren't masked) but cap the length
  // so a giant string can't blow out the error UI.
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}
