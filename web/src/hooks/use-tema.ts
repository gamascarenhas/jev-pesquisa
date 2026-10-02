import { useCallback, useState } from 'react';

export type Tema = 'claro' | 'escuro';

const CHAVE_DO_TEMA = 'tema';
const CLASSE_DO_TEMA_ESCURO = 'tema-escuro';

// O armazenamento pode falhar em janela anônima ou com dados bloqueados; o tema claro é o padrão.
export function lerTemaSalvo(): Tema {
  try {
    return localStorage.getItem(CHAVE_DO_TEMA) === 'escuro' ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.classList.toggle(CLASSE_DO_TEMA_ESCURO, tema === 'escuro');
}

function salvarTema(tema: Tema): void {
  try {
    localStorage.setItem(CHAVE_DO_TEMA, tema);
  } catch {
    // Sem armazenamento, a escolha vale só até recarregar a página.
  }
}

export function useTema() {
  const [tema, definirTema] = useState<Tema>(lerTemaSalvo);
  const alternarTema = useCallback(() => {
    definirTema((atual) => {
      const novo: Tema = atual === 'claro' ? 'escuro' : 'claro';
      aplicarTema(novo);
      salvarTema(novo);
      return novo;
    });
  }, []);
  return { tema, alternarTema };
}
