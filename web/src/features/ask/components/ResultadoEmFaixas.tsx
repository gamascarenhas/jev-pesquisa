import { useState } from 'react';

import { perguntarApi } from '@/api/perguntar.api';
import type {
  FaixaDaPergunta,
  FiltrosDoPainel,
  RespostaDaPergunta,
  ResultadoDaPergunta,
} from '@/api/types';
import { Botao } from '@/components/ui/Botao';
import { Cartao } from '@/components/ui/Cartao';
import { Etiqueta } from '@/components/ui/Etiqueta';
import { Paginacao } from '@/components/ui/Paginacao';
import type { TomDeEtiqueta } from '@/components/ui/variants';
import { botaoVariantes } from '@/components/ui/variants';
import { textos } from '@/i18n/pt-BR';
import { formatarData, formatarNumero, interpolar } from '@/lib/format';

import { useResultadoDaPergunta } from '../hooks/use-perguntas';

const FAIXAS: FaixaDaPergunta[] = ['yes', 'uncertain', 'no'];
const TOM_DA_FAIXA: Record<FaixaDaPergunta, TomDeEtiqueta> = {
  yes: 'sucesso',
  uncertain: 'atencao',
  no: 'neutro',
};
const CHAVE_DA_CONTAGEM = { yes: 'sim', uncertain: 'incerto', no: 'nao' } as const;

interface ResultadoEmFaixasProps {
  projetoId: string;
  perguntaId: string;
  filtros: FiltrosDoPainel;
  acompanhar: boolean;
}

function Linha({ resposta, faixa }: { resposta: RespostaDaPergunta; faixa: FaixaDaPergunta }) {
  const { perguntar: t } = textos;
  const meta = [
    resposta.unidade,
    resposta.comentadoEm === null ? null : formatarData(resposta.comentadoEm),
    resposta.nota === null ? null : `${String(resposta.nota)}/5`,
  ].filter((parte) => parte !== null);
  return (
    <li className="superficie-plana flex flex-col gap-1 p-3">
      <div className="pilha-horizontal justify-between">
        <Etiqueta tom={TOM_DA_FAIXA[faixa]}>
          {interpolar(t.probabilidade, {
            porcentagem: String(Math.round(resposta.probabilidade * 100)),
          })}
        </Etiqueta>
        <span className="texto-auxiliar">{meta.join(' · ')}</span>
      </div>
      <p className="texto-corpo">{resposta.texto ?? t.semTexto}</p>
    </li>
  );
}

interface AbasDeFaixaProps {
  faixa: FaixaDaPergunta;
  contagens: { sim: number; incerto: number; nao: number };
  aoEscolher: (faixa: FaixaDaPergunta) => void;
}

function AbasDeFaixa({ faixa, contagens, aoEscolher }: AbasDeFaixaProps) {
  const { perguntar: t } = textos;
  return (
    <div role="tablist" aria-label={t.rotulo} className="pilha-horizontal">
      {FAIXAS.map((item) => (
        <Botao
          key={item}
          role="tab"
          aria-selected={faixa === item}
          variante={faixa === item ? 'primario' : 'secundario'}
          tamanho="sm"
          onClick={() => {
            aoEscolher(item);
          }}
        >
          {`${t.faixas[item] ?? item} (${formatarNumero(contagens[CHAVE_DA_CONTAGEM[item]])})`}
        </Botao>
      ))}
    </div>
  );
}

interface ListaDeRespostasProps {
  resultado: ResultadoDaPergunta;
  faixa: FaixaDaPergunta;
  pagina: number;
  aoMudarPagina: (pagina: number) => void;
}

function ListaDeRespostas({ resultado, faixa, pagina, aoMudarPagina }: ListaDeRespostasProps) {
  const { perguntar: t } = textos;
  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      {resultado.itens.length === 0 ? (
        <p className="texto-corpo texto-secundario">{t.semResultados}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resultado.itens.map((resposta) => (
            <Linha key={resposta.id} resposta={resposta} faixa={faixa} />
          ))}
        </ul>
      )}
      <Paginacao
        rotulo={t.mudarPagina}
        pagina={pagina}
        totalDePaginas={Math.max(1, Math.ceil(resultado.total / resultado.tamanhoPagina))}
        aoMudar={aoMudarPagina}
      />
    </div>
  );
}

export function ResultadoEmFaixas({
  projetoId,
  perguntaId,
  filtros,
  acompanhar,
}: ResultadoEmFaixasProps) {
  const [faixa, setFaixa] = useState<FaixaDaPergunta>('yes');
  const [pagina, setPagina] = useState(1);
  const { data } = useResultadoDaPergunta(
    projetoId,
    perguntaId,
    filtros,
    faixa,
    pagina,
    acompanhar,
  );
  const { perguntar: t } = textos;
  const escolher = (nova: FaixaDaPergunta): void => {
    setFaixa(nova);
    setPagina(1);
  };
  if (data === undefined) {
    return <p className="texto-corpo">{textos.comum.carregando}</p>;
  }
  const { contagens } = data;
  const avaliados = contagens.sim + contagens.incerto + contagens.nao;

  return (
    <Cartao
      titulo={interpolar(t.contador, {
        sim: formatarNumero(contagens.sim),
        total: formatarNumero(avaliados),
      })}
    >
      <div className="pilha-horizontal justify-between">
        <AbasDeFaixa faixa={faixa} contagens={contagens} aoEscolher={escolher} />
        <a
          href={perguntarApi.enderecoDaExportacao(projetoId, perguntaId, filtros, faixa)}
          download
          className={botaoVariantes({ variante: 'secundario', tamanho: 'sm' })}
        >
          {t.exportar}
        </a>
      </div>
      <ListaDeRespostas resultado={data} faixa={faixa} pagina={pagina} aoMudarPagina={setPagina} />
    </Cartao>
  );
}
