import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logotipo } from '@/components/layout/Logotipo';
import { textos } from '@/i18n/pt-BR';

interface TelaDeAutenticacaoProps {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}

export function TelaDeAutenticacao({ titulo, subtitulo, children }: TelaDeAutenticacaoProps) {
  return (
    <main className="tela-centralizada">
      <Logotipo />
      <div className="superficie-plana coluna-formulario flex flex-col gap-6 p-8">
        <header className="flex flex-col gap-2">
          <h1 className="texto-titulo-pagina">{titulo}</h1>
          {subtitulo !== undefined && <p className="texto-corpo texto-secundario">{subtitulo}</p>}
        </header>
        {children}
      </div>
      <nav className="pilha-horizontal" aria-label={textos.legal.termos.titulo}>
        <Link to="/termos" className="texto-auxiliar texto-link">
          {textos.termos.termosDeUso}
        </Link>
        <Link to="/privacidade" className="texto-auxiliar texto-link">
          {textos.termos.politica}
        </Link>
      </nav>
    </main>
  );
}
