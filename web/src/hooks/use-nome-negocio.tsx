import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { autenticacaoApi } from '@/api/autenticacao.api';
import { chavesConsulta } from '@/api/chaves-consulta';

const ContextoDoNome = createContext('');

export function ProvedorDeNomeDoNegocio({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: chavesConsulta.configuracaoPublica,
    queryFn: autenticacaoApi.configuracaoPublica,
    staleTime: Infinity,
  });
  const nomeNegocio = data?.nomeNegocio ?? '';

  useEffect(() => {
    if (nomeNegocio !== '') {
      document.title = nomeNegocio;
    }
  }, [nomeNegocio]);

  return <ContextoDoNome value={nomeNegocio}>{children}</ContextoDoNome>;
}

export function useNomeNegocio(): string {
  return useContext(ContextoDoNome);
}
