import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { simularApi } from '@/test/api-falsa';
import { criarUsuario, renderizarComProvedores } from '@/test/renderizar';

import { PlanosPage } from './PlanosPage';

function api(papel: 'owner' | 'member', porcentagem = 40) {
  simularApi({
    'GET /auth/eu': { corpo: criarUsuario({ papel }) },
    'GET /conta': {
      corpo: {
        id: 'c',
        nome: 'Loja',
        plano: { id: 'pro', nome: 'Pro' },
        cicloTerminaEm: '2026-11-01T00:00:00.000Z',
      },
    },
    'GET /consumo': {
      corpo: {
        porcentagem,
        limiteAtingido: porcentagem >= 100,
        cicloTerminaEm: '2026-11-01T00:00:00.000Z',
      },
    },
    'GET /planos': {
      corpo: {
        itens: [
          { id: 'trial', nome: 'Teste', precoMensalCentavos: 0 },
          { id: 'pro', nome: 'Pro', precoMensalCentavos: 29_900 },
        ],
      },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlanosPage', () => {
  it('mostra os planos, o atual e o consumo em porcentagem', async () => {
    api('owner');
    renderizarComProvedores(<PlanosPage />);

    expect(await screen.findByText('Plano atual')).toBeInTheDocument();
    expect(screen.getByText('Teste')).toBeInTheDocument();
    expect(screen.getByText('Grátis')).toBeInTheDocument();
    expect(screen.getByText('40% do plano usado')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/US\$|USD|dólar|token|modelo/i);
  });

  it('o owner vê a troca de plano desabilitada com a mensagem de em breve', async () => {
    api('owner');
    renderizarComProvedores(<PlanosPage />);

    const botao = await screen.findByRole('button', { name: 'Trocar de plano' });
    expect(botao).toBeDisabled();
    expect(screen.getByText('Troca de plano disponível em breve')).toBeInTheDocument();
  });

  it('o member não vê o botão de troca', async () => {
    api('member');
    renderizarComProvedores(<PlanosPage />);

    await screen.findByText('Plano atual');
    expect(screen.queryByRole('button', { name: 'Trocar de plano' })).not.toBeInTheDocument();
  });

  it('avisa quando o limite do mês foi atingido', async () => {
    api('owner', 100);
    renderizarComProvedores(<PlanosPage />);

    expect(await screen.findByText(/O limite do mês foi atingido/)).toBeInTheDocument();
  });
});
