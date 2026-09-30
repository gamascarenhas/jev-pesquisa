import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { chavesConsulta } from '@/api/chaves-consulta';
import { exclusaoDadosApi } from '@/api/exclusao-dados.api';
import type { Papel } from '@/api/types';

export function useUsuarios() {
  return useQuery({ queryKey: chavesConsulta.usuarios, queryFn: autenticacaoApi.listarUsuarios });
}

export function useConvites() {
  return useQuery({ queryKey: chavesConsulta.convites, queryFn: autenticacaoApi.listarConvites });
}

export function useConta() {
  return useQuery({ queryKey: chavesConsulta.conta, queryFn: autenticacaoApi.obterConta });
}

export function useRemoverUsuario(aoConcluir: () => void) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => autenticacaoApi.removerUsuario(id),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesConsulta.usuarios });
      aoConcluir();
    },
  });
}

export function useConvidar(aoConcluir: () => void) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (dados: { email: string; papel: Papel }) =>
      autenticacaoApi.convidar(dados.email, dados.papel),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesConsulta.convites });
      aoConcluir();
    },
  });
}

export function useRevogarConvite(aoConcluir: () => void) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => autenticacaoApi.revogarConvite(id),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesConsulta.convites });
      aoConcluir();
    },
  });
}

export function useEncerrarConta(aoConcluir: () => void) {
  return useMutation({
    mutationFn: (senha: string) => exclusaoDadosApi.encerrarConta(senha),
    onSuccess: aoConcluir,
  });
}
