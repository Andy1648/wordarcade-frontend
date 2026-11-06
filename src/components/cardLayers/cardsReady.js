// cardsReady.js — the menu's FIRST-PAGE cards show their painted art TOGETHER (Andy nov4: "the game cards take a while to
// load … try to reduce the amount of inconsistency"). Each priority card registers the decode of its backdrop + hero;
// once every registered card is ready (or MAX_WAIT_MS after the first registers — never a stuck blank), it sets
// html[data-cards-ready] and the CSS fades the whole page's art in at once. Off-page cards never register (lazy).
const MAX_WAIT_MS = 3000;
let waiting = 0;
let timer = 0;
let open = typeof document !== 'undefined' && document.documentElement.hasAttribute('data-cards-ready');

function release() {
  if (open) return;
  open = true;
  clearTimeout(timer);
  try {
    document.documentElement.setAttribute('data-cards-ready', '');
    performance.mark('taw:cards-ready'); // the moment the first page's art shows (perf probes read it)
  } catch { /* no DOM */ }
}

/** A priority card's art is loading: `ready` resolves (or rejects) once it has decoded. */
export function registerCardArt(ready) {
  if (open) return;
  waiting += 1;
  if (!timer) timer = setTimeout(release, MAX_WAIT_MS);
  const done = () => {
    waiting -= 1;
    // a tick for the sibling cards of the same render to register before the page counts as complete
    if (waiting <= 0) setTimeout(() => { if (waiting <= 0) release(); }, 0);
  };
  Promise.resolve(ready).then(done, done);
}

/** True once the first page's art has been released (a card mounted later — a flip, a remount — shows at once). */
export const cardsReady = () => open;
