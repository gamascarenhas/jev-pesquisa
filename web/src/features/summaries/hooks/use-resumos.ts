import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { resumosApi } from '@/api/resumos.api';

const INTERVALO_DA_GERACAO_MS = 2_000;

export function useResumos(projetoId: string) {
  return useQuery({
    queryKey: chavesConsulta.resumos(projetoId),
    queryFn: () => resumosApi.listar(projetoId),
    refetchInterval: (consulta) =>
      consulta.state.data?.emAndamento === true ? INTERVALO_DA_GERACAO_MS : false,
  });
}

export function useGerarResumos(projetoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => resumosApi.gerar(projetoId),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesConsulta.resumos(projetoId) }),
  });
}

export function useComentariosDoAchado(projetoId: string, resumoId: string, indice: number) {
  return useQuery({
    queryKey: chavesConsulta.comentariosDoAchado(resumoId, indice),
    queryFn: () => resumosApi.comentariosDoAchado(projetoId, resumoId, indice),
  });
}
