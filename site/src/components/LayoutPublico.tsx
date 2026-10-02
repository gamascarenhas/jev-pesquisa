import type { ReactNode } from 'react';

import { textosDoSite } from '@site/i18n/site.pt-BR';
import type { Metadados } from '@site/seo/metadados';

import { CabecalhoPublico } from './CabecalhoPublico';
import { Documento } from './Documento';
import { RodapePublico } from './RodapePublico';

interface LayoutPublicoProps {
  metadados: Metadados;
  arquivosCss: string[];
  children: ReactNode;
}

export function LayoutPublico({ metadados, arquivosCss, children }: LayoutPublicoProps) {
  return (
    <Documento metadados={metadados} arquivosCss={arquivosCss}>
      <a href="#conteudo" className="site-pular">
        {textosDoSite.navegacao.irParaOConteudo}
      </a>
      <CabecalhoPublico />
      <main id="conteudo">{children}</main>
      <RodapePublico />
    </Documento>
  );
}
