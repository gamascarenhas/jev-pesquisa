import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { aplicarTema, lerTemaSalvo } from './hooks/use-tema';
import './styles/index.css';

aplicarTema(lerTemaSalvo());

const raiz = document.getElementById('raiz');
if (raiz === null) {
  throw new Error('Elemento #raiz não encontrado.');
}

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
