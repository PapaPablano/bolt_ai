import './env';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { pwaManager } from './lib/pwa';

const queryClient = new QueryClient();

pwaManager.register().then((registration) => {
  if (registration) {
    console.log('[PWA] Service worker registered successfully');
  }
}).catch((error) => {
  console.error('[PWA] Service worker registration failed:', error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
