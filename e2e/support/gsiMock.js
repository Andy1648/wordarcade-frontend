// e2e/support/gsiMock.js — Google's script, stood in for (the real one needs a real Google account + an allowed origin). It
// behaves like GIS's documented surface: initialize(config) overwrites the config, renderButton draws "Google's" button,
// and a click calls config.callback with a JWT-shaped ID token whose `nonce` / `aud` are what `initialize` was given.
// The page can bend one attempt: window.__gsiNonce (a token minted for someone else's nonce), window.__gsiAud (another
// app's token), window.__gsiSilent (the popup closed, or a school blocked it: GIS tells the page nothing).
export const GSI_URL = 'https://accounts.google.com/gsi/client';

const GSI_JS = `(() => {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\\+/g, '-').replace(/\\//g, '_');
  let cfg = null;
  window.__gsiInits = 0;
  window.google = { accounts: { id: {
    initialize(c) { cfg = c; window.__gsiInits += 1; window.__gsiCfg = c; },
    renderButton(el, o) {
      window.__gsiButton = o;
      el.textContent = '';
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.testid = 'gsi-official';
      b.textContent = 'Sign in with Google';
      b.style.cssText = 'height:40px;background:#fff;color:#1f1f1f;border:1px solid #747775;border-radius:4px;width:' + o.width + 'px';
      b.onclick = () => {
        if (o.click_listener) o.click_listener();
        if (window.__gsiSilent) return;
        const claims = { iss: 'https://accounts.google.com', aud: window.__gsiAud || cfg.client_id, sub: 'g-1', email: 'kid@example.com', nonce: window.__gsiNonce || cfg.nonce };
        window.__gsiLast = b64({ alg: 'RS256' }) + '.' + b64(claims) + '.sig';
        cfg.callback({ credential: window.__gsiLast, select_by: 'btn' });
      };
      el.appendChild(b);
    },
  } } };
})();`;

export async function mockGsi(page, { blocked = false } = {}) {
  const state = { blocked, requests: 0 };
  await page.route(GSI_URL, (route) => {
    state.requests += 1;
    if (state.blocked) return route.abort('blockedbyclient'); // a school filter
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: GSI_JS });
  });
  return state;
}
