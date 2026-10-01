import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { googleApi } from '@/api/google.api';

const INTERVALO_DA_SINCRONIZACAO_MS = 2_000;

export function useStatusDoGoogle(projetoId: string) {
  return useQuery({
    queryKey: chavesConsulta.google(projetoId),
    queryFn: () => googleApi.status(projetoId),
    refetchInterval: (consulta) =>
      consulta.state.data?.sincronizando === true ? INTERVALO_DA_SINCRONIZACAO_MS : false,
  });
}

export function useUnidadesDoGoogle(projetoId: string, habilitada: boolean) {
  return useQuery({
    queryKey: chavesConsulta.unidadesDoGoogle(projetoId),
    queryFn: () => googleApi.unidades(projetoId),
    enabled: habilitada,
  });
}

// Qualquer mudança na conexão ou na sincronização refaz o status e o painel do projeto.
function useAtualizarAposMudar(projetoId: string) {
  const cliente = useQueryClient();
  return async () => {
    await cliente.invalidateQueries({ queryKey: ['google', projetoId] });
    await cliente.invalidateQueries({ queryKey: chavesConsulta.painel(projetoId) });
  };
}

export function useConectarGoogle(projetoId: string) {
  return useMutation({
    mutationFn: () => googleApi.conectar(projetoId),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}

export function useEscolherUnidades(projetoId: string) {
  const atualizar = useAtualizarAposMudar(projetoId);
  return useMutation({
    mutationFn: (unidades: string[]) => googleApi.escolherUnidades(projetoId, unidades),
    onSuccess: atualizar,
  });
}

export function useSincronizarGoogle(projetoId: string) {
  const atualizar = useAtualizarAposMudar(projetoId);
  return useMutation({ mutationFn: () => googleApi.sincronizar(projetoId), onSuccess: atualizar });
}

export function useDesconectarGoogle(projetoId: string) {
  const atualizar = useAtualizarAposMudar(projetoId);
  return useMutation({ mutationFn: () => googleApi.desconectar(projetoId), onSuccess: atualizar });
}
