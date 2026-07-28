import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

/**
 * The store hydrates synchronously from localStorage before the first paint,
 * so the opening frame is already the restored state — no splash, no loading
 * screen, no network call between opening the app and seeing the cue.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Precache on first load so the app never needs the venue's wifi again.
// Updates are applied silently on the next launch — never mid-show.
registerSW({ immediate: true });
