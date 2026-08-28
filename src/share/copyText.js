// src/share/copyText.js
// Copy a string to the clipboard: the async Clipboard API first, an execCommand
// text-selection fallback for older / insecure (non-HTTPS) contexts where
// navigator.clipboard is absent or blocked. Returns Promise<boolean> (did it copy).
// Must be called inside a user gesture for the fallback's execCommand to be allowed.

export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* clipboard blocked / not permitted — fall through to the selection fallback */
  }
  return legacyCopy(text);
}

// Hidden off-screen textarea + select + document.execCommand('copy'). The textarea is
// readonly and fixed off-screen so it never scrolls the page or shows a caret.
function legacyCopy(text) {
  if (typeof document === 'undefined') return false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch { /* iOS quirk — select() already covered it */ }
    const ok = document.execCommand && document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}
