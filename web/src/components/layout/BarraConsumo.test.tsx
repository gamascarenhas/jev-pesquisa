import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { BarraConsumo } from './BarraConsumo';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BarraConsumo', () => {
  it('mostra só a porcentagem, nunca dólar, tokens ou modelo', async () => {
    simularApi({
      'GET /consumo': {
        corpo: {
          porcentagem: 42.7,
          limiteAtingido: false,
          cicloTerminaEm: '2026-11-01T00:00:00.000Z',
        },
      },
    });
    renderizarComProvedores(<BarraConsumo />);

    expect(await screen.findByText('42% do plano usado')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Uso do plano' })).toHaveAttribute(
      'value',
      '42',
    );
    expect(document.body.textContent).not.toMatch(/US\$|\$|token|modelo|jev/i);
  });

  it('com o limite atingido, diz quando renova', async () => {
    simularApi({
      'GET /consumo': {
        corpo: {
          porcentagem: 103,
          limiteAtingido: true,
          cicloTerminaEm: '2026-11-01T12:00:00.000Z',
        },
      },
    });
    renderizarComProvedores(<BarraConsumo />);

    expect(await screen.findByText(/Limite do mês atingido. Renova em/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
  });
});
