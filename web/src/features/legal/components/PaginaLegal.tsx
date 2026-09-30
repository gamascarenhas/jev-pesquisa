import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logotipo } from '@/components/layout/Logotipo';
import { Alerta } from '@/components/ui/Alerta';
import { textos } from '@/i18n/pt-BR';

export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="pagina-conteudo flex max-w-leitura flex-col gap-6">
      <header className="cabecalho-pagina">
        <Logotipo />
        <Link to="/entrar" className="texto-link">
          {textos.legal.voltar}
        </Link>
      </header>
      <Alerta tom="atencao">{textos.legal.provisorio}</Alerta>
      <h1 className="texto-titulo-pagina">{titulo}</h1>
      <div className="pilha-vertical">{children}</div>
    </main>
  );
}
