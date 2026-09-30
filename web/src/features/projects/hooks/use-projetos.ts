import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { exclusaoDadosApi } from '@/api/exclusao-dados.api';
import { projetosApi } from '@/api/projetos.api';

export function useProjetos(pagina: number) {
  return useQuery({
    queryKey: chavesConsulta.projetos(pagina),
    queryFn: () => projetosApi.listar(pagina),
  });
}

function useAtualizarListaAoConcluir() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries({ queryKey: chavesConsulta.todosOsProjetos });
}

export function useCriarProjeto(aoConcluir: () => void) {
  const atualizar = useAtualizarListaAoConcluir();
  return useMutation({
    mutationFn: (nome: string) => projetosApi.criar(nome),
    onSuccess: async () => {
      await atualizar();
      aoConcluir();
    },
  });
}

export function useRenomearProjeto(id: string, aoConcluir: () => void) {
  const atualizar = useAtualizarListaAoConcluir();
  return useMutation({
    mutationFn: (nome: string) => projetosApi.renomear(id, nome),
    onSuccess: async () => {
      await atualizar();
      aoConcluir();
    },
  });
}

export function useApagarProjeto(id: string, aoConcluir: () => void) {
  const atualizar = useAtualizarListaAoConcluir();
  return useMutation({
    mutationFn: (nomeProjeto: string) => exclusaoDadosApi.apagarProjeto(id, nomeProjeto),
    onSuccess: async () => {
      await atualizar();
      aoConcluir();
    },
  });
}
