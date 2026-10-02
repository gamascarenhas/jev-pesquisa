import { montarConsulta } from '@/lib/consulta';

import { requisitar } from './http';
import { consultaDosFiltros } from './painel.api';
import type {
  FaixaDaPergunta,
  FiltrosDoPainel,
  InicioDaSincronizacao,
  Lista,
  Pergunta,
  PerguntaDetalhada,
  ResultadoDaPergunta,
} from './types';

export const TAMANHO_PAGINA_RESPOSTAS = 10;

const base = (projetoId: string): string => `/projetos/${projetoId}/perguntas`;

function consulta(filtros: FiltrosDoPainel, extras: Record<string, string | number>): string {
  const doFiltro = consultaDosFiltros(filtros);
  const dosExtras = montarConsulta(extras);
  return doFiltro === '' ? dosExtras : `${doFiltro}&${dosExtras.slice(1)}`;
}

export const perguntarApi = {
  interpretar: (projetoId: string, texto: string, filtros: FiltrosDoPainel) =>
    requisitar<PerguntaDetalhada>('POST', base(projetoId), { texto, filtros }),
  confirmar: (projetoId: string, perguntaId: string) =>
    requisitar<Partial<InicioDaSincronizacao>>(
      'POST',
      `${base(projetoId)}/${perguntaId}/confirmar`,
    ),
  obter: (projetoId: string, perguntaId: string) =>
    requisitar<PerguntaDetalhada>('GET', `${base(projetoId)}/${perguntaId}`),
  historico: (projetoId: string) => requisitar<Lista<Pergunta>>('GET', base(projetoId)),
  resultado: (
    projetoId: string,
    perguntaId: string,
    filtros: FiltrosDoPainel,
    faixa: FaixaDaPergunta,
    pagina: number,
  ) =>
    requisitar<ResultadoDaPergunta>(
      'GET',
      `${base(projetoId)}/${perguntaId}/resultado${consulta(filtros, { faixa, pagina, tamanhoPagina: TAMANHO_PAGINA_RESPOSTAS })}`,
    ),
  // O navegador baixa o arquivo direto pela rota, com os mesmos filtros e a faixa que está na tela.
  enderecoDaExportacao: (
    projetoId: string,
    perguntaId: string,
    filtros: FiltrosDoPainel,
    faixa: FaixaDaPergunta,
  ) => `/api${base(projetoId)}/${perguntaId}/exportacao${consulta(filtros, { faixa })}`,
};
