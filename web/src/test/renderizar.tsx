import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

import type { Usuario } from '@/api/types';
import { criarClienteDeConsultas } from '@/app/providers';
import { ProvedorDeAvisos } from '@/components/ui/AvisoTemporario';
import { ProvedorDeNomeDoNegocio } from '@/hooks/use-nome-negocio';

export function criarUsuario(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    id: 'usuario-1',
    nome: 'Ana Souza',
    email: 'ana@empresa.com.br',
    papel: 'owner',
    emailConfirmado: true,
    criadoEm: '2026-01-01T00:00:00.000Z',
    ...sobrescritas,
  };
}

interface OpcoesDeRenderizacao {
  rota?: string;
}

export function renderizarComProvedores(ui: ReactElement, opcoes: OpcoesDeRenderizacao = {}) {
  const cliente = criarClienteDeConsultas();
  return render(
    <QueryClientProvider client={cliente}>
      <ProvedorDeNomeDoNegocio>
        <ProvedorDeAvisos>
          <MemoryRouter initialEntries={[opcoes.rota ?? '/']}>{ui}</MemoryRouter>
        </ProvedorDeAvisos>
      </ProvedorDeNomeDoNegocio>
    </QueryClientProvider>,
  );
}
