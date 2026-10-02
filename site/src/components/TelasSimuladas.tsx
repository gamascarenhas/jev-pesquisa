import { botaoVariantes, etiquetaVariantes } from '@/components/ui/variants';
import { textosDoSite } from '@site/i18n/site.pt-BR';

import { MolduraDoApp } from './MolduraDoApp';

const { demonstracao } = textosDoSite;

export function TelaImportar() {
  const { importar } = demonstracao;
  return (
    <MolduraDoApp titulo={importar.titulo}>
      <ol className="flex flex-wrap gap-2">
        {importar.passos.map((passo, indice) => (
          <li
            key={passo}
            className={
              indice === 1 ? 'site-app-passo borda-passo-atual' : 'site-app-passo site-app-passo-outro'
            }
          >
            <span className="texto-auxiliar">{indice === 0 ? '✓' : indice + 1}</span>
            <span className="texto-rotulo">{passo}</span>
          </li>
        ))}
      </ol>
      <div className="superficie-plana site-app-cartao">
        <p className="texto-titulo-secao">{importar.mapeamentoTitulo}</p>
        <ul className="flex flex-col gap-2">
          {importar.colunas.map(({ coluna, uso }) => (
            <li key={coluna} className="site-app-mapeamento">
              <span className="site-app-coluna texto-celula">{coluna}</span>
              <span className="site-app-campo texto-corpo">
                {uso}
                <span aria-hidden="true">▾</span>
              </span>
            </li>
          ))}
        </ul>
        <span className={botaoVariantes({ variante: 'primario', tamanho: 'sm' })}>
          {importar.botao}
        </span>
      </div>
    </MolduraDoApp>
  );
}

export function TelaClassificar() {
  const { classificar } = demonstracao;
  return (
    <MolduraDoApp titulo={classificar.titulo}>
      <div className="superficie-plana site-app-tabela">
        <div className="site-app-linha site-app-cabecalho">
          {classificar.colunas.map((coluna) => (
            <span key={coluna} className="texto-cabecalho-tabela">
              {coluna}
            </span>
          ))}
        </div>
        {classificar.linhas.map((linha) => (
          <div key={linha.texto} className="site-app-linha">
            <span className="texto-celula">{linha.texto}</span>
            <span className="texto-celula texto-secundario">{linha.tema}</span>
            <span>
              <span className={etiquetaVariantes({ tom: linha.sentimento.tom })}>
                {linha.sentimento.rotulo}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="texto-celula">{linha.confianca}%</span>
              {linha.revisar && (
                <span className={etiquetaVariantes({ tom: 'atencao' })}>
                  {classificar.revisar}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </MolduraDoApp>
  );
}

export function TelaPainel() {
  const { painel } = demonstracao;
  return (
    <MolduraDoApp titulo={painel.titulo}>
      <div className="site-app-cartoes">
        {painel.cartoes.map((cartao) => (
          <div key={cartao.rotulo} className="superficie-plana site-app-cartao">
            <span className="texto-auxiliar">{cartao.rotulo}</span>
            <span className="texto-destaque">{cartao.valor}</span>
          </div>
        ))}
      </div>
      <div className="superficie-plana site-app-cartao">
        <p className="texto-titulo-secao">{painel.graficoTitulo}</p>
        <GraficoDeTemas />
      </div>
    </MolduraDoApp>
  );
}

const SEGMENTOS = ['positivo', 'neutro', 'misto', 'negativo'] as const;

type TemaDoGrafico = (typeof demonstracao.painel.temas)[number];

function segmentosDoTema(tema: TemaDoGrafico) {
  return SEGMENTOS.map((segmento, indice) => ({
    segmento,
    largura: tema[segmento],
    x: SEGMENTOS.slice(0, indice).reduce((soma, anterior) => soma + tema[anterior], 0),
  }));
}

function GraficoDeTemas() {
  const { painel } = demonstracao;
  return (
    <div className="flex flex-col gap-3">
      {painel.temas.map((tema) => (
        <div key={tema.nome} className="site-app-grafico-linha">
          <span className="texto-auxiliar">{tema.nome}</span>
          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="site-app-grafico-barra">
            {segmentosDoTema(tema).map(({ segmento, x, largura }) => (
              <rect
                key={segmento}
                x={x}
                width={largura}
                height="10"
                className={`site-grafico-${segmento}`}
              />
            ))}
          </svg>
        </div>
      ))}
      <ul className="flex flex-wrap gap-3">
        {SEGMENTOS.map((segmento) => (
          <li key={segmento} className="flex items-center gap-1">
            <span className={`site-app-legenda site-legenda-${segmento}`} />
            <span className="texto-auxiliar">{painel.legenda[segmento]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TelaResumo() {
  const { resumo } = demonstracao;
  return (
    <MolduraDoApp titulo={resumo.titulo}>
      <div className="site-app-cartoes-resumo">
        {resumo.cartoes.map((cartao) => (
          <div key={cartao.tema} className="superficie-plana site-app-cartao">
            <div className="flex items-center justify-between gap-2">
              <span className="texto-titulo-secao">{cartao.tema}</span>
              <span className={etiquetaVariantes({ tom: cartao.alerta.tom })}>
                {cartao.alerta.rotulo}
              </span>
            </div>
            <span className="texto-auxiliar">{cartao.numeros}</span>
            <p className="texto-corpo">{cartao.texto}</p>
            <span className="texto-auxiliar">{cartao.variacao}</span>
            <span className="texto-link texto-corpo">{resumo.verComentarios}</span>
          </div>
        ))}
      </div>
      <p className="texto-auxiliar">{resumo.geradoPorIa}</p>
    </MolduraDoApp>
  );
}
