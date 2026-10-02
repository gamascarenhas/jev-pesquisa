import { textosDoSite } from '@site/i18n/site.pt-BR';

import { VinhetaClassificar, VinhetaImportar, VinhetaPainel } from './Vinhetas';

const VINHETAS_DOS_PASSOS = [VinhetaImportar, VinhetaClassificar, VinhetaPainel];

export function SecaoComoFunciona() {
  const { comoFunciona } = textosDoSite;
  return (
    <section
      id="como-funciona"
      className="site-secao site-secao-sutil"
      aria-labelledby="titulo-como-funciona"
    >
      <div className="site-conteudo flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-como-funciona" className="site-titulo-secao">
            {comoFunciona.titulo}
          </h2>
          <p className="site-texto-secundario">{comoFunciona.subtitulo}</p>
        </div>
        <ol className="flex flex-col">
          {comoFunciona.passos.map((passo, indice) => {
            const VinhetaDoPasso = VINHETAS_DOS_PASSOS[indice];
            return (
              <li key={passo.titulo} className="site-passo">
                <div className="site-passo-trilha" aria-hidden="true">
                  <span className="site-numero">{indice + 1}</span>
                  <span className="site-passo-linha" />
                </div>
                <div className="site-passo-texto">
                  <h3 className="texto-titulo-secao">{passo.titulo}</h3>
                  <p className="site-texto-secundario">{passo.texto}</p>
                </div>
                {VinhetaDoPasso && (
                  <div className="site-passo-vinheta">
                    <VinhetaDoPasso />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
