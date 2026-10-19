// boot.jsx — mounts the PREVIEW-ONLY juice lab in place of the app (src/main.jsx, /?juicelab=1).
import React from 'react';
import ReactDOM from 'react-dom/client';
import JuiceLab from './JuiceLab.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <JuiceLab />
  </React.StrictMode>,
);
