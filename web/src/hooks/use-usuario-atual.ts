import { useQuery } from '@tanstack/react-query';

import { ErroDaApi } from '@/api/http';
import { autenticacaoApi } from '@/api/autenticacao.api';
import { chavesConsulta } from '@/api/chaves-consulta';
import type { Usuario } from '@/api/types';

const STATUS_NAO_AUTENTICADO = 401;

async function buscarUsuarioAtual(): Promise<Usuario | null> {
  try {
    return await autenticacaoApi.obterEu();
  } catch (erro) {
    if (erro instanceof ErroDaApi && erro.status === STATUS_NAO_AUTENTICADO) {
      return null;
    }
    throw erro;
  }
}

export function useUsuarioAtual() {
  return useQuery({
    queryKey: chavesConsulta.eu,
    queryFn: buscarUsuarioAtual,
    staleTime: Infinity,
    retry: false,
  });
}
