import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { FiltrosDoPainel as Filtros, OpcoesDoPainel } from '@/api/types';

import { FiltrosDoPainel } from './FiltrosDoPainel';

const OPCOES: OpcoesDoPainel = {
  fontes: [
    { id: 'f-1', nome: 'planilha.csv' },
    { id: 'f-2', nome: 'outra.csv' },
  ],
  unidades: ['Centro', 'Norte'],
};

function renderizar(filtros: Filtros = {}) {
  const aoMudar = vi.fn();
  render(<FiltrosDoPainel opcoes={OPCOES} filtros={filtros} aoMudar={aoMudar} />);
  return aoMudar;
}

describe('FiltrosDoPainel', () => {
  it('oferece as fontes e unidades do projeto e os rótulos em português', () => {
    renderizar();

    expect(screen.getByRole('option', { name: 'planilha.csv' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Norte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Tempo de espera' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Misto' })).toBeInTheDocument();
  });

  it('cada escolha muda só o seu filtro e preserva os outros', async () => {
    const aoMudar = renderizar({ unidade: 'Centro' });

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'Preço');
    await userEvent.selectOptions(screen.getByLabelText('Sentimento'), 'Negativo');
    await userEvent.selectOptions(screen.getByLabelText('Fonte'), 'outra.csv');

    expect(aoMudar).toHaveBeenNthCalledWith(1, { unidade: 'Centro', tema: 'price' });
    expect(aoMudar).toHaveBeenNthCalledWith(2, { unidade: 'Centro', sentimento: 'negative' });
    expect(aoMudar).toHaveBeenNthCalledWith(3, { unidade: 'Centro', fonteId: 'f-2' });
  });

  it('volta a "todos" removendo o filtro', async () => {
    const aoMudar = renderizar({ tema: 'price' });

    await userEvent.selectOptions(screen.getByLabelText('Tema'), 'Todos');

    expect(aoMudar).toHaveBeenCalledWith({ tema: undefined });
  });

  it('filtra por período com datas', async () => {
    const aoMudar = renderizar();

    await userEvent.type(screen.getByLabelText('De'), '2024-03-01');

    expect(aoMudar).toHaveBeenLastCalledWith({ de: '2024-03-01' });
  });

  it('marca "só os que precisam de ação" e limpa tudo', async () => {
    const aoMudar = renderizar({ tema: 'price' });

    await userEvent.click(screen.getByLabelText('Só os que precisam de ação'));
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));

    expect(aoMudar).toHaveBeenNthCalledWith(1, { tema: 'price', precisaAcao: true });
    expect(aoMudar).toHaveBeenNthCalledWith(2, {});
  });
});
