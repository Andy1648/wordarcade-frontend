// CardPager.jsx — the CARD PAGES controls (feat/chromebook-card-pages). Lazy: only a short-wide desktop
// (Homepage.jsx PAGED_MENU_QUERY) ever loads it, so a tall desktop / phone first load pays nothing for it.
// Homepage keeps the page STATE, the fit-math and the off-page hide (Homepage.css); this module is the
// arrows, the two-dot indicator and the input (←/→ keys, touch swipe) + the finite flip slide.
// One component, three slots, so the arrows sit either side of the card row and the dots under it — all
// in flow inside .homepage-cards-region (no fixed UI).
import { useEffect, useLayoutEffect, useRef } from 'react';
import { sfx } from '../juice';
import './CardPager.css';

const PER_PAGE = 3;

function Arrow({ dir, page, pageCount, onFlip }) {
  const spent = dir < 0 ? page <= 0 : page >= pageCount - 1;
  return (
    <button
      type="button"
      className={`homepage-cards-arrow ${dir < 0 ? 'is-prev' : 'is-next'}`}
      aria-label={dir < 0 ? 'Previous games' : 'Next games'}
      aria-disabled={spent}
      onClick={() => { if (!spent) { sfx('tap'); onFlip(page + dir); } }}
    >
      <span aria-hidden="true">{dir < 0 ? '←' : '→'}</span>
    </button>
  );
}

// The input + the slide. Renders nothing.
function Controls({ page, onFlip, gridRef, rowRef, blockedRef }) {
  const live = useRef({ page, onFlip });
  live.current = { page, onFlip };
  const prevPage = useRef(page);
  const focusMove = useRef(false);

  // The arrows just mounted: re-run the fit so it pays for their width.
  useEffect(() => {
    const r = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    return () => cancelAnimationFrame(r);
  }, []);

  useEffect(() => {
    const flip = (to) => {
      const grid = gridRef.current;
      const a = document.activeElement;
      focusMove.current = !!(grid && a && grid.contains(a));
      live.current.onFlip(to);
    };
    // ←/→ while the menu itself has the keys: never in a text field, never under an open dialog / panel,
    // never with a modifier. Letters are untouched — they still go to the menu's typing.
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || blockedRef.current) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      flip(live.current.page + (e.key === 'ArrowRight' ? 1 : -1));
    };
    // Swipe: touch / pen only — a mouse drag would fight the cards' own press + magnetic pull.
    let start = null;
    const down = (e) => { start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    const up = (e) => {
      const s = start;
      start = null;
      if (!s || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(e.clientY - s.y) * 1.5) return;
      flip(live.current.page + (dx < 0 ? 1 : -1));
    };
    const cancel = () => { start = null; };
    const row = rowRef.current;
    window.addEventListener('keydown', onKey);
    if (row) {
      row.addEventListener('pointerdown', down);
      row.addEventListener('pointerup', up);
      row.addEventListener('pointercancel', cancel);
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      if (row) {
        row.removeEventListener('pointerdown', down);
        row.removeEventListener('pointerup', up);
        row.removeEventListener('pointercancel', cancel);
      }
    };
  }, [gridRef, rowRef, blockedRef]);

  // The flip: focus follows to the same slot on the new page, then a finite transform/opacity slide
  // (~260ms, will-change only for its life). Reduced motion: the swap is instant.
  useLayoutEffect(() => {
    const dir = Math.sign(page - prevPage.current);
    prevPage.current = page;
    const grid = gridRef.current;
    if (!dir || !grid) return undefined;
    if (focusMove.current) {
      focusMove.current = false;
      const first = grid.querySelector(`.game-card-magnet:nth-child(${page * PER_PAGE + 1}) .game-card`);
      if (first) first.focus({ preventScroll: true });
    }
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { reduce = false; }
    if (reduce || typeof grid.animate !== 'function') return undefined;
    grid.style.willChange = 'transform, opacity';
    const anim = grid.animate(
      [{ transform: `translateX(${dir * 48}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
    );
    const done = () => { grid.style.willChange = ''; };
    anim.onfinish = done;
    anim.oncancel = done;
    return () => anim.cancel();
  }, [page, gridRef]);

  return null;
}

export default function CardPager({ slot, page, pageCount, onFlip, gridRef, rowRef, blockedRef }) {
  if (slot === 'prev') return <Arrow dir={-1} page={page} pageCount={pageCount} onFlip={onFlip} />;
  if (slot === 'next') return <Arrow dir={1} page={page} pageCount={pageCount} onFlip={onFlip} />;
  if (slot === 'dots') {
    return (
      <div className="homepage-cards-dots" aria-hidden="true">
        {Array.from({ length: pageCount }, (_, i) => (
          <span key={i} className={`homepage-cards-dot${i === page ? ' is-on' : ''}`} data-page={i} />
        ))}
      </div>
    );
  }
  return <Controls page={page} onFlip={onFlip} gridRef={gridRef} rowRef={rowRef} blockedRef={blockedRef} />;
}
