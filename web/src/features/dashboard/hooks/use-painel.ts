import { useQuery } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { painelApi } from '@/api/painel.api';
import type { FiltrosDoPainel } from '@/api/types';

export function usePainel(projetoId: string, filtros: FiltrosDoPainel) {
  return useQuery({
    queryKey: chavesConsulta.dadosDoPainel(projetoId, filtros),
    queryFn: () => painelApi.consultar(projetoId, filtros),
  });
}

export function useOpcoesDoPainel(projetoId: string) {
  return useQuery({
    queryKey: chavesConsulta.opcoesDoPainel(projetoId),
    queryFn: () => painelApi.opcoes(projetoId),
  });
}
