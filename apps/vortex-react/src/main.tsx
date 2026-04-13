import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { VortexBlotterProvider } from '@vortex/blotter-react';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VortexBlotterProvider>
      <App />
    </VortexBlotterProvider>
  </StrictMode>,
);
