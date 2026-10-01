import { useQuery } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { consumoApi } from '@/api/consumo.api';

const ATUALIZAR_A_CADA_MS = 30_000;

export function useConsumo() {
  return useQuery({
    queryKey: chavesConsulta.consumo,
    queryFn: consumoApi.obter,
    refetchInterval: ATUALIZAR_A_CADA_MS,
  });
}
