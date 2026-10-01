import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chavesConsulta } from '@/api/chaves-consulta';
import { comentariosApi, type Correcao } from '@/api/comentarios.api';

export function useFilaDeRevisao(projetoId: string, pagina: number) {
  return useQuery({
    queryKey: chavesConsulta.filaDeRevisao(projetoId, pagina),
    queryFn: () => comentariosApi.fila(projetoId, pagina),
    placeholderData: keepPreviousData,
  });
}

// Corrigir tira o comentário da fila e muda os números do painel, então tudo do projeto é recarregado.
export function useCorrigirComentario(
  projetoId: string,
  comentarioId: string,
  aoConcluir: () => void,
) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (correcao: Correcao) => comentariosApi.corrigir(projetoId, comentarioId, correcao),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: chavesConsulta.painel(projetoId) });
      aoConcluir();
    },
  });
}
