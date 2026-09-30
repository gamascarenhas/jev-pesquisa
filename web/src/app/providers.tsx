import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ProvedorDeAvisos } from '@/components/ui/AvisoTemporario';
import { ProvedorDeNomeDoNegocio } from '@/hooks/use-nome-negocio';

export function criarClienteDeConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [cliente] = useState(criarClienteDeConsultas);
  return (
    <QueryClientProvider client={cliente}>
      <ProvedorDeNomeDoNegocio>
        <ProvedorDeAvisos>{children}</ProvedorDeAvisos>
      </ProvedorDeNomeDoNegocio>
    </QueryClientProvider>
  );
}
