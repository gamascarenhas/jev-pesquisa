import type { ComponentType } from 'react';

import { textosDoSite } from '@site/i18n/site.pt-BR';

import { TelaClassificar, TelaImportar, TelaPainel, TelaResumo } from './TelasSimuladas';

type Etapa = (typeof textosDoSite.demonstracao.etapas)[number];

const TELAS: Record<Etapa['id'], ComponentType> = {
  importar: TelaImportar,
  classificar: TelaClassificar,
  painel: TelaPainel,
  resumo: TelaResumo,
};

// Abas só com CSS (rádios + :has), porque o site público é HTML estático, sem JavaScript.
export function SecaoDemonstracao() {
  const { demonstracao } = textosDoSite;
  return (
    <section
      id="demonstracao"
      className="site-secao site-demo"
      aria-labelledby="titulo-demonstracao"
    >
      <div className="site-conteudo flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 id="titulo-demonstracao" className="site-titulo-secao">
            {demonstracao.titulo}
          </h2>
          <p className="site-texto-secundario">{demonstracao.subtitulo}</p>
        </div>
        <div role="radiogroup" aria-label={demonstracao.abasRotulo} className="site-demo-abas">
          {demonstracao.etapas.map((etapa, indice) => (
            <label key={etapa.id} className="site-demo-aba">
              <input
                type="radio"
                name="demonstracao"
                value={etapa.id}
                defaultChecked={indice === 0}
                className="sr-only"
              />
              {etapa.aba}
            </label>
          ))}
        </div>
        {demonstracao.etapas.map((etapa) => (
          <PainelDaEtapa key={etapa.id} etapa={etapa} />
        ))}
        <p className="texto-auxiliar">{demonstracao.aviso}</p>
      </div>
    </section>
  );
}

function PainelDaEtapa({ etapa }: { etapa: Etapa }) {
  const { demonstracao } = textosDoSite;
  const Tela = TELAS[etapa.id];
  return (
    <div className="site-demo-painel" data-etapa={etapa.id}>
      <div className="flex flex-col gap-2">
        <h3 className="texto-titulo-secao">{etapa.titulo}</h3>
        <p className="site-texto-secundario">{etapa.texto}</p>
      </div>
      <div className="site-dispositivos">
        <figure
          className="site-computador"
          aria-label={demonstracao.rotuloComputador.replace('{etapa}', etapa.aba)}
        >
          <div className="site-computador-moldura">
            <div className="site-computador-tela tema-claro" aria-hidden="true">
              <Tela />
            </div>
          </div>
          <div className="site-computador-base" />
        </figure>
        <figure
          className="site-celular"
          aria-label={demonstracao.rotuloCelular.replace('{etapa}', etapa.aba)}
        >
          <div className="site-celular-tela tema-escuro" aria-hidden="true">
            <Tela />
          </div>
        </figure>
      </div>
    </div>
  );
}
