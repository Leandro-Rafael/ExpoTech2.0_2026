import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/index.css';
import '@fontsource-variable/space-grotesk/index.css';
import './styles/index.css';
import { App } from './app/App';

// Modo demonstração (npm run dev:mock): API simulada no navegador. Removido do build de produção.
if (import.meta.env.MODE === 'mock') await import('./mocks');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
