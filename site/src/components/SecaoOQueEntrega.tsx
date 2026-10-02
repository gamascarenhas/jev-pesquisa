import { textosDoSite } from '@site/i18n/site.pt-BR';

import { VinhetaOrdem } from './Vinhetas';
import {
  VinhetaExportacao,
  VinhetaFiltros,
  VinhetaPerguntas,
  VinhetaResumo,
} from './VinhetasDaEntrega';

const VINHETAS_DA_ENTREGA = [
  VinhetaOrdem,
  VinhetaFiltros,
  VinhetaResumo,
  VinhetaPerguntas,
  VinhetaExportacao,
];

export function SecaoOQueEntrega() {
  const { entrega } = textosDoSite;
  return (
    <section className="site-secao site-secao-sutil" aria-labelledby="titulo-entrega">
      <div className="site-conteudo flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-entrega" className="site-titulo-secao">
            {entrega.titulo}
          </h2>
          <p className="site-texto-secundario">{entrega.subtitulo}</p>
        </div>
        <ul className="site-bento">
          {entrega.itens.map((item, indice) => {
            const VinhetaDoItem = VINHETAS_DA_ENTREGA[indice];
            return (
              <li key={item.titulo} className="site-bloco site-bento-cartao">
                {VinhetaDoItem && <VinhetaDoItem />}
                <div className="flex flex-col gap-2">
                  <h3 className="texto-titulo-secao">{item.titulo}</h3>
                  <p className="site-texto-secundario">{item.texto}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
