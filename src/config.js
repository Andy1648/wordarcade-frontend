// config.js
// Single source of truth for the backend's WebSocket URL. Keeping this
// in one file (rather than hardcoding the URL wherever it's needed)
// means redeploying the backend to a new URL later is a one-line change.

// Render serves over https, so the WebSocket equivalent is wss (secure
// WebSocket) at the same host - no separate port needed, Render routes
// the upgrade request through the same domain.
export const BACKEND_WS_URL = 'wss://chain-reaction-backend-i6kx.onrender.com';