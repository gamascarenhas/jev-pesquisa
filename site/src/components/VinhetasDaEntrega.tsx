import { Download, FileText, Search } from 'lucide-react';

import { botaoVariantes, etiquetaVariantes } from '@/components/ui/variants';
import { cn } from '@/lib/cn';
import { textosDoSite } from '@site/i18n/site.pt-BR';

import { Vinheta } from './Vinhetas';

const { vinhetas } = textosDoSite;

export function VinhetaFiltros() {
  const { filtros } = vinhetas;
  return (
    <Vinheta>
      <span className="flex flex-wrap gap-1">
        {filtros.chips.map((chip) => (
          <span key={chip} className={etiquetaVariantes({ tom: 'neutro' })}>
            {chip}
          </span>
        ))}
      </span>
      <ul className="flex flex-col gap-2">
        {filtros.linhas.map((linha, indice) => (
          <li
            key={linha}
            className={cn('site-recorte site-recorte-linha', indice === 1 && 'site-recorte-ativo')}
          >
            <span className="texto-auxiliar site-texto-cortado">{linha}</span>
            {indice === 1 && (
              <span className={etiquetaVariantes({ tom: 'atencao' })}>{filtros.revisar}</span>
            )}
          </li>
        ))}
      </ul>
    </Vinheta>
  );
}

export function VinhetaResumo() {
  const { resumo } = vinhetas;
  return (
    <Vinheta>
      <div className="site-recorte flex flex-col gap-2">
        <span className="flex items-center justify-between gap-2">
          <span className="texto-rotulo">{resumo.tema}</span>
          <span className={etiquetaVariantes({ tom: 'critico' })}>{resumo.alerta}</span>
        </span>
        <span className="texto-auxiliar">{resumo.numeros}</span>
        <span className="texto-corpo">{resumo.texto}</span>
        <span className="texto-link texto-auxiliar">{resumo.link}</span>
      </div>
    </Vinheta>
  );
}

export function VinhetaPerguntas() {
  const { perguntas } = vinhetas;
  return (
    <Vinheta>
      <span className="site-app-campo texto-corpo">
        <span className="flex min-w-0 items-center gap-2">
          <Search size="1rem" className="site-icone-acao" />
          <span className="site-texto-cortado">{perguntas.pergunta}</span>
        </span>
      </span>
      <div className="site-recorte flex flex-col gap-2">
        {perguntas.faixas.map((faixa) => (
          <span key={faixa.rotulo} className="flex flex-col gap-1">
            <span className="flex justify-between gap-2">
              <span className="texto-auxiliar">{faixa.rotulo}</span>
              <span className="texto-auxiliar site-numero-tabular">{faixa.total}</span>
            </span>
            <progress className="barra-progresso" value={faixa.total} max={perguntas.maximo} />
          </span>
        ))}
      </div>
    </Vinheta>
  );
}

export function VinhetaExportacao() {
  const { exportacao } = vinhetas;
  return (
    <Vinheta>
      <div className="site-recorte site-recorte-linha">
        <span className="flex min-w-0 items-center gap-2">
          <FileText size="1.1rem" className="site-icone-acao" />
          <span className="texto-rotulo site-texto-cortado">{exportacao.arquivo}</span>
        </span>
      </div>
      <div className="site-recorte site-recorte-tabela">
        {exportacao.colunas.map((coluna) => (
          <span key={coluna} className="texto-cabecalho-tabela site-texto-cortado">
            {coluna}
          </span>
        ))}
        {exportacao.colunas.map((coluna) => (
          <span key={`a-${coluna}`} className="site-esqueleto" />
        ))}
        {exportacao.colunas.map((coluna) => (
          <span key={`b-${coluna}`} className="site-esqueleto site-esqueleto-curto" />
        ))}
      </div>
      <span className={cn(botaoVariantes({ variante: 'primario', tamanho: 'sm' }), 'self-start')}>
        <Download size="0.9rem" />
        {exportacao.botao}
      </span>
    </Vinheta>
  );
}
