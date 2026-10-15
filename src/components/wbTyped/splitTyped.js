// splitTyped.js — Word Bomb live prompt (Andy oct15, "JUST LIKE word bomb from roblox"): the letters the player on the
// clock is typing gather AROUND the fragment. Pure: given what they typed and the fragment, where does each letter sit?
//   * the fragment is IN the word      → letters before it / the fragment fully lit / letters after it
//   * the word ENDS in a start of it   → the earlier letters before it, that many fragment letters lit (typing "F" on FA)
//   * otherwise                        → every letter before it, nothing lit (typing "FG" on FA moves "FG" in front)
// Case-insensitive; returns the typed letters uppercased.
export function splitTyped(typed, combo) {
  const t = String(typed || '').toUpperCase();
  const c = String(combo || '').toUpperCase();
  if (!c) return { pre: t, lit: 0, post: '', hit: false };
  const at = t.indexOf(c);
  if (at >= 0) return { pre: t.slice(0, at), lit: c.length, post: t.slice(at + c.length), hit: true };
  for (let k = Math.min(c.length - 1, t.length); k > 0; k--) {
    if (t.endsWith(c.slice(0, k))) return { pre: t.slice(0, t.length - k), lit: k, post: '', hit: false };
  }
  return { pre: t, lit: 0, post: '', hit: false };
}
