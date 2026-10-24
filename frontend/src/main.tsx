import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fontes: Geist (UI), Geist Mono (dados/rótulos), Fraunces com eixo óptico (h1/h2), Space Grotesk (só o logo).
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
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
