import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { perguntarApi } from '@/api/perguntar.api';
import type { FaixaDaPergunta, FiltrosDoPainel, PerguntaDetalhada } from '@/api/types';

const INTERVALO_DA_PERGUNTA_MS = 2_000;

function emAndamento(pergunta: PerguntaDetalhada | undefined): boolean {
  return pergunta?.status === 'running' || pergunta?.status === 'paused_limit';
}

export function useHistoricoDePerguntas(projetoId: string) {
  return useQuery({
    queryKey: chavesConsulta.perguntas(projetoId),
    queryFn: () => perguntarApi.historico(projetoId),
  });
}

export function usePergunta(projetoId: string, perguntaId: string | null) {
  return useQuery({
    queryKey: chavesConsulta.pergunta(projetoId, perguntaId ?? ''),
    queryFn: () => perguntarApi.obter(projetoId, perguntaId ?? ''),
    enabled: perguntaId !== null,
    refetchInterval: (consulta) =>
      emAndamento(consulta.state.data) ? INTERVALO_DA_PERGUNTA_MS : false,
  });
}

export function useResultadoDaPergunta(
  projetoId: string,
  perguntaId: string,
  filtros: FiltrosDoPainel,
  faixa: FaixaDaPergunta,
  pagina: number,
  acompanhar: boolean,
) {
  return useQuery({
    queryKey: chavesConsulta.resultadoDaPergunta(perguntaId, filtros, faixa, pagina),
    queryFn: () => perguntarApi.resultado(projetoId, perguntaId, filtros, faixa, pagina),
    placeholderData: keepPreviousData,
    refetchInterval: acompanhar ? INTERVALO_DA_PERGUNTA_MS : false,
  });
}

export function useInterpretarPergunta(projetoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ texto, filtros }: { texto: string; filtros: FiltrosDoPainel }) =>
      perguntarApi.interpretar(projetoId, texto, filtros),
    onSuccess: async (pergunta) => {
      cliente.setQueryData(chavesConsulta.pergunta(projetoId, pergunta.id), pergunta);
      await cliente.invalidateQueries({ queryKey: chavesConsulta.perguntas(projetoId) });
    },
  });
}

export function useConfirmarPergunta(projetoId: string, perguntaId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => perguntarApi.confirmar(projetoId, perguntaId),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: ['perguntas', projetoId] });
    },
  });
}
