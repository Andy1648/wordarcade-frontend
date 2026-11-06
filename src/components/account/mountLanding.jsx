// mountLanding.jsx — the sign-in popup finished on whatever screen the button is on (SETTINGS, the shop's GEMS tab), and the
// button itself unmounts the moment the session lands. So the LINK / LOAD YOUR PROGRESS step gets its own little root,
// independent of the screen under it, and removes itself when it's done.
import { createRoot } from 'react-dom/client';
import AuthLanding from './AuthLanding.jsx';

export function mountLanding() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const done = () => { root.unmount(); host.remove(); };
  root.render(<AuthLanding onDone={done} />);
}
