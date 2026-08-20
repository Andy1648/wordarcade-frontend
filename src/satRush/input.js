// input.js — the fixed-slot input model for SAT RUSH. Pure: no React, no DOM.
//
// This is the mechanic that keeps the mode a VOCAB game and not a spelling test.
// The letter count (known from stage 0) is fixed and shown as one slot per letter;
// a key is accepted ONLY if it is the target's next letter. A rejected key does NOT
// enter the field — the cursor never advances — so the player can never get
// stranded in a wrong prefix, and `typed` is always a prefix of the target.
//
// TARGET ONLY. There used to be a same-length "alt" (synonym) mechanic: typing a
// valid synonym of the same length completed the word for half credit. Playtests
// read it as a BUG, not a feature — typing 'a' for SHREWD "landed" because the
// same-length synonym ASTUTE was reachable, and then the TARGET's own letters were
// rejected until you backspaced, a trap under the timer. So alt typing is gone:
// only the target's letters are ever accepted. The `alts` field STAYS in words.json
// — the suspect picker (suspects.js) uses it to avoid unfair distractors — it is
// just no longer typeable here.
//
// The engine decides WHEN letters are revealed (stage-4 first letter, every 3rd
// wrong keystroke); this module just applies a reveal to the slots.

/**
 * @param {object} opts
 * @param {string} opts.target  the word to reach (the only word that can be typed)
 */
export function createSlotInput({ target } = {}) {
  const word = String(target).toLowerCase();
  const length = word.length;

  let typed = ''; // current slot contents, left to right — always a target prefix
  let revealed = 0; // count of locked leading letters (always the target prefix)

  const isComplete = () => typed.length === length;

  function result(extra) {
    return {
      typed,
      revealed,
      complete: isComplete(),
      ...extra,
    };
  }

  /**
   * Try to accept a typed letter. Accepted iff it is the target's next letter.
   * Returns { accepted, complete, reason, ... }. A rejected key leaves the field
   * untouched (the caller shakes / bleeds score; the cursor does not advance).
   */
  function typeLetter(raw) {
    const letter = String(raw).toLowerCase();
    if (isComplete()) return result({ accepted: false, reason: 'complete' });
    if (!/^[a-z]$/.test(letter)) return result({ accepted: false, reason: 'invalid' });
    if (word[typed.length] !== letter) {
      // Not the target's next letter — reject, do not advance.
      return result({ accepted: false, reason: 'reject' });
    }
    typed += letter;
    return result({ accepted: true, reason: isComplete() ? 'complete' : 'accept' });
  }

  /**
   * Reveal the next (leftmost unrevealed) letter of the target and lock it. `typed`
   * is always a target prefix, so this just locks one more leading letter, filling
   * the slot if the player hasn't typed that far yet. No divergence to snap back.
   */
  function revealNextLetter() {
    if (revealed >= length) return result({ revealedLetter: null });
    const next = revealed + 1;
    if (typed.length < next) typed = word.slice(0, next);
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
    answer: () => word, // the target — for the "the word was X" reveal on a clear
  };
}
