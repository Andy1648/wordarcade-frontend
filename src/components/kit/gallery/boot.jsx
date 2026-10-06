// boot.jsx — mounts the DEV-ONLY kit gallery in place of the app (src/main.jsx, /?kit=1).
import React from 'react';
import ReactDOM from 'react-dom/client';
import KitGallery from './KitGallery.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <KitGallery />
  </React.StrictMode>,
);
