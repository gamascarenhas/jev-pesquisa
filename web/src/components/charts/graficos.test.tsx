import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ContagemDeGravidade, ContagemTemaSentimento } from '@/api/types';

import { GraficoGravidade } from './GraficoGravidade';
import { agruparPorTema, GraficoTemaSentimento } from './GraficoTemaSentimento';

const TEMAS: ContagemTemaSentimento[] = [
  { tema: 'wait_time', sentimento: 'negative', total: 5 },
  { tema: 'wait_time', sentimento: 'positive', total: 1 },
  { tema: 'service', sentimento: 'positive', total: 4 },
  { tema: 'price', sentimento: 'mixed', total: 2 },
];
const GRAVIDADE: ContagemDeGravidade[] = [
  { nivel: 0, total: 4 },
  { nivel: 1, total: 2 },
  { nivel: 2, total: 3 },
  { nivel: 3, total: 1 },
];

describe('agruparPorTema', () => {
  it('soma os sentimentos de cada tema e ordena do maior para o menor', () => {
    const linhas = agruparPorTema(TEMAS);

    expect(linhas.map((l) => [l.rotulo, l.total])).toEqual([
      ['Tempo de espera', 6],
      ['Atendimento', 4],
      ['Preço', 2],
    ]);
    expect(linhas[0]).toMatchObject({ negative: 5, positive: 1 });
  });
});

describe('gráficos', () => {
  it('o gráfico de barras renderiza em SVG sem criar elemento <style> nem usar cor fixa', () => {
    const estilosAntes = document.querySelectorAll('style').length;

    const { container } = render(<GraficoTemaSentimento dados={TEMAS} />);

    expect(document.querySelectorAll('style')).toHaveLength(estilosAntes);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBeGreaterThan(0);
    const preenchimentos = [...container.querySelectorAll('.recharts-bar-rectangle path')].map(
      (p) => p.getAttribute('fill'),
    );
    expect(preenchimentos.length).toBeGreaterThan(0);
    expect(preenchimentos.every((cor) => cor?.startsWith('var(--cor-sentimento-'))).toBe(true);
    expect(screen.getByText('Comentários por tema e sentimento')).toBeInTheDocument();
  });

  it('mostra a legenda e os temas em português', () => {
    render(<GraficoTemaSentimento dados={TEMAS} />);

    expect(screen.getByText('Positivo')).toBeInTheDocument();
    expect(screen.getByText('Negativo')).toBeInTheDocument();
    expect(screen.getAllByText('Tempo de espera').length).toBeGreaterThan(0);
  });

  it('o gráfico de gravidade usa uma cor de token por nível e também não injeta <style>', () => {
    const estilosAntes = document.querySelectorAll('style').length;

    const { container } = render(<GraficoGravidade dados={GRAVIDADE} />);

    expect(document.querySelectorAll('style')).toHaveLength(estilosAntes);
    const cores = [...container.querySelectorAll('.recharts-bar-rectangle path')].map((p) =>
      p.getAttribute('fill'),
    );
    expect(cores).toEqual([
      'var(--cor-gravidade-0)',
      'var(--cor-gravidade-1)',
      'var(--cor-gravidade-2)',
      'var(--cor-gravidade-3)',
    ]);
    expect(screen.getByText('Sem problema')).toBeInTheDocument();
    expect(screen.getByText('Problema sério')).toBeInTheDocument();
  });
});
