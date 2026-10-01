import { useMutation, useQuery } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { enviosApi } from '@/api/envios.api';
import { trabalhosApi } from '@/api/trabalhos.api';
import type { MapeamentoDeColunas, PreviaDoEnvio, Trabalho } from '@/api/types';

import { INTERVALO_DE_CONSULTA_MS } from '../limites';

export function useEnviarArquivo(projetoId: string) {
  return useMutation({ mutationFn: (arquivo: File) => enviosApi.enviar(projetoId, arquivo) });
}

export function useTrocarAba(projetoId: string, envioId: string) {
  return useMutation({
    mutationFn: (aba: string) => enviosApi.previa(projetoId, envioId, aba),
  });
}

export interface EntradaDeConfirmacao {
  previa: PreviaDoEnvio;
  mapeamento: MapeamentoDeColunas;
}

export function useConfirmarEnvio(projetoId: string) {
  return useMutation({
    mutationFn: ({ previa, mapeamento }: EntradaDeConfirmacao) =>
      enviosApi.confirmar(projetoId, previa.envioId, {
        ...(previa.aba === null ? {} : { aba: previa.aba }),
        nomeArquivo: previa.nomeArquivo,
        mapeamento,
      }),
  });
}

function trabalhoTerminou(trabalho: Trabalho | undefined): boolean {
  return trabalho?.status === 'done' || trabalho?.status === 'failed';
}

export function useAcompanharTrabalho(trabalhoId: string) {
  return useQuery({
    queryKey: chavesConsulta.trabalho(trabalhoId),
    queryFn: () => trabalhosApi.obter(trabalhoId),
    refetchInterval: (consulta) =>
      trabalhoTerminou(consulta.state.data) ? false : INTERVALO_DE_CONSULTA_MS,
  });
}

export function useResumoDaFonte(projetoId: string, fonteId: string, habilitado: boolean) {
  return useQuery({
    queryKey: chavesConsulta.fonte(projetoId, fonteId),
    queryFn: () => enviosApi.fonte(projetoId, fonteId),
    enabled: habilitado,
  });
}
