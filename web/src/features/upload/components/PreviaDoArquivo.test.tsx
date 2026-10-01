import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PreviaDoEnvio } from '@/api/types';

import { PreviaDoArquivo } from './PreviaDoArquivo';

function criarPrevia(quantidadeDeLinhas: number): PreviaDoEnvio {
  return {
    envioId: 'envio.csv',
    tipo: 'csv',
    nomeArquivo: 'avaliacoes.csv',
    abas: [],
    aba: null,
    cabecalho: ['Comentário', 'Nota'],
    linhas: Array.from({ length: quantidadeDeLinhas }, (_v, i) => [`Texto ${String(i + 1)}`, '5']),
    totalLinhas: 1_200,
    sugestao: {},
  };
}

describe('PreviaDoArquivo', () => {
  it('mostra as 10 primeiras linhas e o cabeçalho do arquivo', () => {
    render(<PreviaDoArquivo previa={criarPrevia(12)} />);

    const tabela = screen.getByRole('table');
    const corpo = within(tabela).getAllByRole('row').slice(1);
    expect(
      within(tabela)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Comentário', 'Nota']);
    expect(corpo).toHaveLength(10);
    expect(screen.getByText('Texto 10')).toBeInTheDocument();
    expect(screen.queryByText('Texto 11')).not.toBeInTheDocument();
  });

  it('informa o total de linhas do arquivo', () => {
    render(<PreviaDoArquivo previa={criarPrevia(3)} />);

    expect(
      screen.getByText('avaliacoes.csv: 1.200 linhas de dados. Mostrando as 3 primeiras.'),
    ).toBeInTheDocument();
  });
});
