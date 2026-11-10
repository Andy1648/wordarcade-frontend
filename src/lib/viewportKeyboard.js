// viewportKeyboard.js — THE PHONE KEYBOARD (Andy nov9: "the game is very not mobile friendly bc of the keyboard on mobile").
// Android Chrome shrinks the page when the keyboard opens (index.html: interactive-widget=resizes-content); iOS Safari does not:
// the page keeps its height and only the VISUAL viewport shrinks, so a game sized to 100dvh sits half under the keyboard.
// One watcher for both:
//   --vvh       the visible height in px. Game roots size to var(--vvh, 100dvh), so they always fit what the player can see.
//   data-kb     ("" or "short") on <html> while a text field is focused and the visible height has collapsed (the keyboard is up). Screens compact
//               under it: the prompt, the timer and the field stay; decoration steps aside.
// Read on resize / focus only: never in a keydown, never per frame. visualViewport.height is a property, not a layout read.

// the keyboard is up when the visible height is under this share of the tallest height seen at this width
export const KB_SHARE = 0.78;
// under this visible height the keyboard leaves only a strip: data-kb="short", where screens drop to the bare minimum
export const SHORT_PX = 440;

/** Is the keyboard up? `h` visible height, `tallest` the tallest seen at this width, `editing` a field has focus. */
export function keyboardUp(h, tallest, editing) {
  return !!editing && tallest > 0 && h < tallest * KB_SHARE;
}

const isField = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
  && !/^(button|checkbox|radio|range|submit|reset|file|color|image|hidden)$/i.test(el.type || '');

/** `seedTall`: the visible height at boot. This loads lazily on the first focus, when the keyboard may already be up. */
export function installViewportKeyboard(win = typeof window !== 'undefined' ? window : null, seedTall = 0) {
  if (!win || !win.document) return () => {};
  const root = win.document.documentElement;
  const vv = win.visualViewport;
  const tallest = new Map(); // width -> tallest visible height seen (a rotation is a new width)
  if (seedTall > 0) tallest.set(Math.round(win.innerWidth), Math.round(seedTall));
  let pending = false;
  let raf = 0;
  const apply = () => {
    const h = Math.round(vv ? vv.height : win.innerHeight);
    const w = Math.round(win.innerWidth);
    const t = Math.max(tallest.get(w) || 0, h);
    tallest.set(w, t);
    root.style.setProperty('--vvh', `${h}px`);
    if (keyboardUp(h, t, isField(win.document.activeElement))) root.setAttribute('data-kb', h < SHORT_PX ? 'short' : '');
    else root.removeAttribute('data-kb');
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    raf = win.requestAnimationFrame(() => { pending = false; apply(); });
  };
  apply();
  const target = vv || win;
  target.addEventListener('resize', schedule);
  if (vv) win.addEventListener('resize', schedule);
  win.addEventListener('focusin', schedule);
  win.addEventListener('focusout', schedule);
  return () => {
    target.removeEventListener('resize', schedule);
    if (vv) win.removeEventListener('resize', schedule);
    win.removeEventListener('focusin', schedule);
    win.removeEventListener('focusout', schedule);
    if (raf) win.cancelAnimationFrame(raf);
  };
}
