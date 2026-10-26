// PrintPicker.jsx — FRENCH RUSH's dropdown, printed (Andy oct26: "the drop down bars for theme and show etc.
// are like the standard ones and break theme"). Replaces every native <select> in the mode: a paper button
// (ink double rule, hard offset shadow) that opens a paper LIST — the options as ruled rows, the chosen one
// INKED (paper on ink), exactly like the setup chips.
//
// The list is portalled onto the .sr-app page (the class frame and the word bank clip their bodies), placed
// under the button — or above it when there is no room — from ONE measure taken at open (never per frame).
// It drops in once (a finite transform/opacity print, CSS) and closes on a pick, Esc, Tab, an outside press,
// a resize or a scroll.
//
// Keyboard (WAI-ARIA listbox): Enter / Space / ↓ / ↑ open it on the chosen row; ↑ ↓ Home End move; a letter
// jumps to the next row starting with it; Enter / Space pick; Esc / Tab close (focus back on the button).
// Taps only on a phone — no text box. Rows are ≥44px, text ≥16px.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * @param {{ label: string, value: string, options: {value: string, label: string}[], onChange: (v: string) => void, className?: string }} props
 */
export default function PrintPicker({ label, value, options, onChange, className = '' }) {
  const id = useId();
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState(null); // { left, top|bottom, width, maxHeight, up }
  const [host, setHost] = useState(null);
  const current = options.find((o) => o.value === value) || options[0];
  const selIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus && btnRef.current) btnRef.current.focus();
  };
  const openAt = (i) => {
    const btn = btnRef.current;
    if (!btn) return;
    const page = btn.closest('.sr-app') || document.body;
    // the one measure: the button and the page, at open
    const b = btn.getBoundingClientRect();
    const p = page.getBoundingClientRect();
    const below = p.bottom - b.bottom - 12;
    const above = b.top - p.top - 12;
    const want = options.length * 50 + 16;
    const up = below < Math.min(want, 260) && above > below;
    setPlace({
      left: Math.max(8, Math.min(b.left - p.left, p.width - Math.max(b.width, 220) - 8)),
      width: Math.max(b.width, 220),
      top: up ? null : b.bottom - p.top + 6,
      bottom: up ? p.bottom - b.top + 6 : null,
      maxHeight: Math.max(160, up ? above : below),
      up,
    });
    setHost(page);
    setActive(i);
    setOpen(true);
  };

  // focus the list once it is on the page, and keep the active row in view (a long list scrolls inside)
  useLayoutEffect(() => {
    if (open && listRef.current) listRef.current.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.children[active];
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  // close on an outside press, a resize, or a scroll of anything but the list
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (listRef.current && listRef.current.contains(e.target)) return;
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      close(false);
    };
    const onScroll = (e) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', onScroll, true);
    };
    // close is stable enough for this listener's life (it only sets state / focuses the button)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (i) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    close(true);
  };

  const onButtonKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      openAt(selIndex);
    }
  };
  const onListKey = (e) => {
    const n = options.length;
    e.stopPropagation(); // the class console's Enter / → / N must not fire while a list is open
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % n);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(n - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      for (let s = 1; s <= n; s += 1) {
        const j = (active + s) % n;
        if (options[j].label.toLowerCase().startsWith(k)) {
          setActive(j);
          break;
        }
      }
    }
  };

  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  return (
    <div className={`fr-pick${open ? ' open' : ''} ${className}`}>
      <span className="sr-setup-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        ref={btnRef}
        className="fr-pick-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${id}-val`}
        onClick={() => (open ? close(true) : openAt(selIndex))}
        onKeyDown={onButtonKey}
      >
        <span className="fr-pick-val" id={`${id}-val`}>
          {current ? current.label : ''}
        </span>
        <span className="fr-pick-caret" aria-hidden="true">
          ▼
        </span>
      </button>
      {open &&
        host &&
        place &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            className={`fr-pick-list${place.up ? ' up' : ''}`}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${id}-o${active}`}
            onKeyDown={onListKey}
            style={{
              left: place.left,
              width: place.width,
              top: place.top == null ? 'auto' : place.top,
              bottom: place.bottom == null ? 'auto' : place.bottom,
              maxHeight: place.maxHeight,
            }}
          >
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`fr-pick-opt${o.value === value ? ' sel' : ''}${i === active ? ' active' : ''}`}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
              >
                {o.label}
              </li>
            ))}
          </ul>,
          host,
        )}
    </div>
  );
}
