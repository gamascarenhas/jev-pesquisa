import { useQuery } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { planosApi } from '@/api/planos.api';

export function usePlanos() {
  return useQuery({ queryKey: chavesConsulta.planos, queryFn: planosApi.listar });
}
