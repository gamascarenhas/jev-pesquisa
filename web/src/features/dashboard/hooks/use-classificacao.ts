import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { classificacaoApi } from '@/api/classificacao.api';
import type { ProgressoDaClassificacao } from '@/api/types';

export const INTERVALO_DO_PROGRESSO_MS = 2_000;

export function useEstimativa(projetoId: string, habilitada: boolean) {
  return useQuery({
    queryKey: chavesConsulta.estimativa(projetoId),
    queryFn: () => classificacaoApi.estimar(projetoId),
    enabled: habilitada,
  });
}

export function estaEmAndamento(progresso: ProgressoDaClassificacao | undefined): boolean {
  return progresso !== undefined && progresso.trabalho !== null;
}

export function useProgressoDaClassificacao(projetoId: string) {
  return useQuery({
    queryKey: chavesConsulta.progressoDaClassificacao(projetoId),
    queryFn: () => classificacaoApi.progresso(projetoId),
    enabled: projetoId !== '',
    refetchInterval: (consulta) =>
      estaEmAndamento(consulta.state.data) ? INTERVALO_DO_PROGRESSO_MS : false,
  });
}

export function useIniciarClassificacao(projetoId: string, reprocessar: boolean) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () =>
      reprocessar
        ? classificacaoApi.reprocessarFalhas(projetoId)
        : classificacaoApi.iniciar(projetoId),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: ['classificacao', projetoId] });
      await cliente.invalidateQueries({ queryKey: chavesConsulta.painel(projetoId) });
    },
  });
}
