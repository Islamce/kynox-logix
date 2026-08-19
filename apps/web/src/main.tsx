import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { applyMode, getStoredMode } from './design/theme';
import { applyLocale, getStoredLocale } from './design/locale';
import './styles.css';

// Apply the stored theme/locale as early as possible from this module script.
// The app's strict CSP (script-src 'self') blocks inline <script>, so both are
// enforced here rather than via an inline bootstrap in index.html. #root is
// empty until React mounts, so there is no content flash.
applyMode(getStoredMode());
applyLocale(getStoredLocale());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
