// Slots.jsx — one fixed slot per letter (count known from stage 0). State is
// conveyed by SHAPE, not colour alone: the current slot has a blinking caret,
// a revealed/locked slot has a double underline + a corner flag, a typed slot
// shows its glyph. `slots` comes straight from input.js (getSlots()).
export default function Slots({ slots, badIndex, badKey }) {
  return (
    // --n (letter count) drives the shrink-to-fit sizing so the row never wraps.
    <div
      className="sr-slots"
      style={{ '--n': slots.length }}
      role="group"
      aria-label="answer letters"
    >
      {slots.map((s) => {
        const cls = ['sr-slot'];
        if (s.state === 'typed') cls.push('typed');
        else if (s.state === 'revealed') cls.push('revealed');
        // The cursor sits on the first empty slot.
        const isCurrent = s.char === null && s.index === firstEmpty(slots);
        if (isCurrent) cls.push('cur');
        if (s.index === badIndex) cls.push('bad');
        const label =
          s.state === 'revealed'
            ? `locked letter ${s.char}`
            : s.state === 'typed'
              ? `letter ${s.char}`
              : isCurrent
                ? 'current empty slot'
                : 'empty slot';
        return (
          // badKey re-keys only the shaken slot so its pulse restarts.
          <div
            key={s.index === badIndex ? `${s.index}-${badKey}` : s.index}
            className={cls.join(' ')}
            aria-label={label}
          >
            {s.char ? s.char.toUpperCase() : ''}
          </div>
        );
      })}
    </div>
  );
}

function firstEmpty(slots) {
  const slot = slots.find((s) => s.char === null);
  return slot ? slot.index : -1;
}
