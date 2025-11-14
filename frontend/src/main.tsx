import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { pwaManager } from './lib/pwa';

pwaManager.register().then((registration) => {
  if (registration) {
    console.log('[PWA] Service worker registered successfully');
  }
}).catch((error) => {
  console.error('[PWA] Service worker registration failed:', error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
