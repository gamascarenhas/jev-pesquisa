import type { ReactNode } from 'react';

import { itemNavegacaoVariantes } from '@/components/ui/variants';
import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';

// Casca do app simulado; o layout muda por container query conforme a largura da moldura.
export function MolduraDoApp({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { app } = textosDoSite.demonstracao;
  return (
    <div className="site-app">
      <div className="site-app-barra">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" className="site-app-menu" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
          <span className="site-app-logo" />
          <span className="texto-rotulo">{comNomeDoNegocio('{nomeNegocio}')}</span>
        </div>
        <span className="texto-auxiliar site-app-consumo">{app.consumo}</span>
      </div>
      <div className="site-app-corpo">
        <div className="site-app-lateral">
          {app.navegacao.map((item, indice) => (
            <span
              key={item}
              className={itemNavegacaoVariantes({ ativo: indice === 0 ? 'sim' : 'nao' })}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="site-app-conteudo">
          <p className="texto-titulo-pagina">{titulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
