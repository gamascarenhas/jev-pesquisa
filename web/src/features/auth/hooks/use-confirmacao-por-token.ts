import { useQuery } from '@tanstack/react-query';

// Consulta (e não mutação) para o modo estrito do React não gastar o token de uso único duas vezes.
export function useConfirmacaoPorToken(
  tipo: string,
  token: string | null,
  confirmar: (token: string) => Promise<unknown>,
) {
  return useQuery({
    queryKey: ['confirmacao', tipo, token],
    queryFn: async () => {
      await confirmar(token ?? '');
      return true;
    },
    enabled: token !== null && token !== '',
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
