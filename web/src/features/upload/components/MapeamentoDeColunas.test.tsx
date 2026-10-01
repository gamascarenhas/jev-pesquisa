import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PreviaDoEnvio } from '@/api/types';

import { MapeamentoDeColunas } from './MapeamentoDeColunas';

function criarPrevia(sobrescritas: Partial<PreviaDoEnvio> = {}): PreviaDoEnvio {
  return {
    envioId: 'envio.csv',
    tipo: 'csv',
    nomeArquivo: 'avaliacoes.csv',
    abas: [],
    aba: null,
    cabecalho: ['Data', 'Cliente', 'Texto livre', 'Nota'],
    linhas: [['01/02/2024', 'Ana', 'Ótimo', '5']],
    totalLinhas: 1,
    sugestao: {},
    ...sobrescritas,
  };
}

function renderizar(previa: PreviaDoEnvio, aoConfirmar = vi.fn()) {
  render(
    <MapeamentoDeColunas
      previa={previa}
      carregando={false}
      aoConfirmar={aoConfirmar}
      aoTrocarArquivo={vi.fn()}
    />,
  );
  return aoConfirmar;
}

describe('MapeamentoDeColunas', () => {
  it('exige a coluna do comentário antes de importar', async () => {
    const aoConfirmar = renderizar(criarPrevia());

    await userEvent.click(screen.getByRole('button', { name: 'Importar comentários' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Escolha a coluna do comentário.');
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('começa com a sugestão do servidor e envia os índices das colunas escolhidas', async () => {
    const aoConfirmar = renderizar(criarPrevia({ sugestao: { comentario: 2, data: 0, nota: 3 } }));

    await userEvent.selectOptions(screen.getByLabelText('Autor'), 'Cliente');
    await userEvent.click(screen.getByRole('button', { name: 'Importar comentários' }));

    expect(screen.getByLabelText('Comentário (obrigatório)')).toHaveValue('2');
    expect(aoConfirmar).toHaveBeenCalledWith({
      comentario: 2,
      data: 0,
      nota: 3,
      unidade: undefined,
      autor: 1,
    });
  });

  it('recusa a mesma coluna em dois usos', async () => {
    const aoConfirmar = renderizar(criarPrevia({ sugestao: { comentario: 2 } }));

    await userEvent.selectOptions(screen.getByLabelText('Nota'), 'Texto livre');
    await userEvent.click(screen.getByRole('button', { name: 'Importar comentários' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Cada coluna só pode ter um uso.');
    expect(aoConfirmar).not.toHaveBeenCalled();
  });
});
