import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { comentariosApi } from '@/api/comentarios.api';
import type { FiltrosDoPainel } from '@/api/types';

export function useComentarios(projetoId: string, filtros: FiltrosDoPainel, pagina: number) {
  return useQuery({
    queryKey: chavesConsulta.comentarios(projetoId, filtros, pagina),
    queryFn: () => comentariosApi.listar(projetoId, filtros, pagina),
    placeholderData: keepPreviousData,
  });
}
