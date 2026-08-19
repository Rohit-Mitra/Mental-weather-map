import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Self-hosted so the app has no network dependency at runtime.
// Anek is by Ek Type, an Indian foundry; the width axis (wdth.css) is what the
// masthead is set on. IBM Plex carries the body and the instrument numerals.
import '@fontsource-variable/anek-latin/wdth.css';
import '@fontsource-variable/anek-devanagari';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
