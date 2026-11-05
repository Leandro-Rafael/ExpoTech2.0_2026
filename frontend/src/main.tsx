// Primeiro arquivo que roda ao abrir o site: carrega fontes/estilos, liga o modo demo se for o caso e monta o <App />.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 1. Fontes e CSS global.
// Fontes: Geist (UI), Geist Mono (dados/rótulos), Fraunces com eixo óptico (h1/h2), Space Grotesk (só o logo).
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/space-grotesk/index.css';
import './styles/index.css';
import { App } from './app/App';

// 2. No modo demo, o simulador da API precisa estar ligado antes da primeira chamada a /api (por isso o await).
// Modo demonstração (npm run dev:mock): API simulada no navegador. Removido do build de produção.
if (import.meta.env.MODE === 'mock') await import('./mocks');

// 3. Desenha o app dentro da <div id="root"> do index.html.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
