import type { ReactNode } from 'react';

import { comNomeDoNegocio, textosDoSite } from '@site/i18n/site.pt-BR';

import { VinhetaDesordem, VinhetaOrdem } from './Vinhetas';

interface Lado {
  titulo: string;
  itens: readonly { titulo: string; texto: string }[];
}

export function SecaoProblema() {
  const { problema } = textosDoSite;
  return (
    <section className="site-secao" aria-labelledby="titulo-problema">
      <div className="site-conteudo flex flex-col gap-8">
        <h2 id="titulo-problema" className="site-titulo-secao">
          {problema.titulo}
        </h2>
        <div className="site-comparacao">
          <LadoDaComparacao lado={problema.antes} destaque={false}>
            <VinhetaDesordem />
          </LadoDaComparacao>
          <LadoDaComparacao lado={problema.depois} destaque>
            <VinhetaOrdem />
          </LadoDaComparacao>
        </div>
      </div>
    </section>
  );
}

interface LadoDaComparacaoProps {
  lado: Lado;
  destaque: boolean;
  children: ReactNode;
}

function LadoDaComparacao({ lado, destaque, children }: LadoDaComparacaoProps) {
  const marca = destaque ? 'site-marca site-marca-sim' : 'site-marca site-marca-nao';
  return (
    <div className={destaque ? 'site-bloco site-lado site-lado-destaque' : 'site-bloco site-lado'}>
      {children}
      <h3 className="texto-titulo-secao">{comNomeDoNegocio(lado.titulo)}</h3>
      <ul className="flex flex-col gap-4">
        {lado.itens.map((item) => (
          <li key={item.titulo} className="flex gap-3">
            <span className={marca} aria-hidden="true">
              {destaque ? '✓' : '✕'}
            </span>
            <div className="flex flex-col gap-1">
              <p className="texto-rotulo">{item.titulo}</p>
              <p className="site-texto-secundario">{item.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
