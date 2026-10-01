import { montarConsulta } from '@/lib/consulta';

import { consultaDosFiltros } from './painel.api';
import { requisitar } from './http';
import type { Comentario, FiltrosDoPainel, Pagina } from './types';

export const TAMANHO_PAGINA_COMENTARIOS = 10;

export interface Correcao {
  tema: string;
  sentimento: string;
}

export const comentariosApi = {
  listar: (projetoId: string, filtros: FiltrosDoPainel, pagina: number) => {
    const filtrosEmTexto = consultaDosFiltros(filtros);
    const paginacao = montarConsulta({ pagina, tamanhoPagina: TAMANHO_PAGINA_COMENTARIOS });
    const consulta = filtrosEmTexto === '' ? paginacao : `${filtrosEmTexto}&${paginacao.slice(1)}`;
    return requisitar<Pagina<Comentario>>('GET', `/projetos/${projetoId}/comentarios${consulta}`);
  },
  fila: (projetoId: string, pagina: number) =>
    requisitar<Pagina<Comentario>>(
      'GET',
      `/projetos/${projetoId}/revisao${montarConsulta({ pagina, tamanhoPagina: TAMANHO_PAGINA_COMENTARIOS })}`,
    ),
  corrigir: (projetoId: string, comentarioId: string, correcao: Correcao) =>
    requisitar<undefined>(
      'PUT',
      `/projetos/${projetoId}/comentarios/${comentarioId}/revisao`,
      correcao,
    ),
};
