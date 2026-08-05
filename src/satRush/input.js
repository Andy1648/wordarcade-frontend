// input.js — the fixed-slot input model for SAT RUSH. Pure: no React, no DOM.
//
// This is the mechanic that keeps the mode a VOCAB game and not a spelling test.
// The letter count (known from stage 0) is fixed and shown as one slot per
// letter; a key is accepted ONLY if it keeps the word reachable:
//
//   A key at cursor index i is accepted iff some candidate — the target OR a
//   same-length alt still consistent with what's typed — has that letter at i.
//   A rejected key does NOT enter the field: the cursor never advances, so the
//   player can never get stranded in a wrong prefix.
//
// Same-length alts are the whole point: for "voracious" a player might type the
// everyday synonym; nine slots can accept "ravenous" (a valid alt) but never
// "hungry" (wrong length). Completing an alt is a half-credit clear that still
// teaches the target ("accepted — the word was PLACID").
//
// The engine decides WHEN letters are revealed (stage-4 first letter, every 3rd
// wrong keystroke); this module just applies a reveal to the slots.

/**
 * @param {object}   opts
 * @param {string}   opts.target  the word to reach
 * @param {string[]} [opts.alts]  accepted same-length alternatives (half credit)
 */
export function createSlotInput({ target, alts = [] } = {}) {
  const word = String(target).toLowerCase();
  const length = word.length;
  // Only same-length alts that aren't the target itself can ever be typed into
  // the slots — anything else is unreachable and is dropped defensively.
  const altList = [
    ...new Set(
      alts
        .map((a) => String(a).toLowerCase())
        .filter((a) => a.length === length && a !== word)
    ),
  ];

  let typed = ''; // current slot contents, left to right (a valid prefix)
  let revealed = 0; // count of locked leading letters (always the target prefix)

  // Candidates still consistent with what's typed. Derived (not mutated) so
  // backspace and reveal stay trivially correct.
  const candidates = () => [word, ...altList].filter((c) => c.startsWith(typed));

  const isComplete = () => typed.length === length;
  const viaAltNow = () => typed !== word; // meaningful only once complete

  function result(extra) {
    return {
      typed,
      revealed,
      complete: isComplete(),
      viaAlt: isComplete() ? viaAltNow() : false,
      actualWord: isComplete() ? word : null,
      ...extra,
    };
  }

  /**
   * Try to accept a typed letter. Returns { accepted, complete, viaAlt,
   * actualWord, ... }. A rejected key leaves the field untouched (the caller
   * shakes / bleeds score; the cursor does not advance).
   */
  function typeLetter(raw) {
    const letter = String(raw).toLowerCase();
    if (isComplete()) return result({ accepted: false, reason: 'complete' });
    if (!/^[a-z]$/.test(letter)) return result({ accepted: false, reason: 'invalid' });

    const i = typed.length;
    const nextChars = new Set(candidates().map((c) => c[i]));
    if (!nextChars.has(letter)) {
      // No reachable word has this letter here — reject, do not advance.
      return result({ accepted: false, reason: 'reject' });
    }
    typed += letter;
    return result({ accepted: true, reason: isComplete() ? 'complete' : 'accept' });
  }

  /**
   * Reveal the next (leftmost unrevealed) letter of the TARGET and lock it. This
   * narrows the candidates toward the target; if the player had diverged onto an
   * alt-only path, the reveal snaps the field back onto the target prefix,
   * discarding the divergent tail (the reveal is a help that places the *right*
   * letter). Target-consistent typing is preserved.
   */
  function revealNextLetter() {
    if (revealed >= length) return result({ revealed: revealed, revealedLetter: null });
    const next = revealed + 1;
    if (word.startsWith(typed)) {
      // On the target path already: just lock one more, filling the slot if the
      // player hasn't reached it yet.
      if (typed.length < next) typed = word.slice(0, next);
    } else {
      // Diverged (alt path): snap onto the target, dropping the divergent tail.
      typed = word.slice(0, next);
    }
    revealed = next;
    return result({ revealedLetter: word[revealed - 1], revealedIndex: revealed - 1 });
  }

  /** Delete the last typed letter. Locked (revealed) letters cannot be removed. */
  function backspace() {
    if (typed.length > revealed) typed = typed.slice(0, -1);
    return result({});
  }

  /** One entry per slot for rendering: { index, char, state }. */
  function getSlots() {
    const slots = [];
    for (let k = 0; k < length; k++) {
      const filled = k < typed.length;
      slots.push({
        index: k,
        char: filled ? typed[k] : null,
        state: k < revealed ? 'revealed' : filled ? 'typed' : 'empty',
      });
    }
    return slots;
  }

  /** Snapshot WITHOUT the answer, so a UI can't accidentally leak the target. */
  function getState() {
    return {
      length,
      typed,
      revealed,
      complete: isComplete(),
      viaAlt: isComplete() ? viaAltNow() : false,
      candidateCount: candidates().length,
    };
  }

  return {
    length,
    typeLetter,
    revealNextLetter,
    backspace,
    getSlots,
    getState,
    isComplete,
    liveCandidates: candidates, // exposed for tests / debugging
    answer: () => word, // the target — for the "the word was X" reveal on a clear
  };
}
