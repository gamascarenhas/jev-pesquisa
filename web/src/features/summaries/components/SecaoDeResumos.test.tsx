import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ResumoDoTema } from '@/api/types';
import { simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { SecaoDeResumos } from './SecaoDeResumos';

function resumo(sobrescritas: Partial<ResumoDoTema>): ResumoDoTema {
  return {
    id: 'r-1',
    tema: 'service',
    periodo: { inicio: '2026-03-01', fim: '2026-03-31' },
    unidade: null,
    status: 'ready',
    nivelDeAlerta: 'stable',
    titulo: 'Título do tema',
    achados: [{ texto: 'Achado principal do tema.', evidencias: ['c1', 'c2'] }],
    numeros: {
      volume: 30,
      percentualNegativo: 40,
      gravidadeMedia: 0.3,
      percentualPrecisaAcao: 10,
      variacaoDoVolume: 25,
      variacaoDoPercentualNegativo: 3,
      unidadesPrincipais: [],
    },
    criadoEm: '2026-04-01T12:00:00.000Z',
    ...sobrescritas,
  };
}

const RESUMOS = [
  resumo({ id: 'r-1', tema: 'service', nivelDeAlerta: 'critical', titulo: 'Atendimento piorou' }),
  resumo({ id: 'r-2', tema: 'price', nivelDeAlerta: 'attention', titulo: 'Preço preocupa' }),
  resumo({
    id: 'r-3',
    tema: 'delivery',
    status: 'too_few_comments',
    titulo: null,
    achados: [],
    numeros: { ...resumo({}).numeros, volume: 4, variacaoDoVolume: null },
  }),
  resumo({ id: 'r-4', tema: 'other', status: 'numbers_only', titulo: null, achados: [] }),
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('seção de resumos', () => {
  it('mostra os cartões na ordem recebida, com o alerta de cada tema', async () => {
    simularApi({ 'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: RESUMOS } } });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    const cartoes = await screen.findAllByRole('article');

    expect(cartoes.map((c) => within(c).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Atendimento',
      'Preço',
      'Entrega',
      'Outro',
    ]);
    expect(within(cartoes.at(0) ?? document.body).getByText('Crítico')).toBeInTheDocument();
    expect(within(cartoes.at(1) ?? document.body).getByText('Atenção')).toBeInTheDocument();
    expect(
      within(cartoes.at(0) ?? document.body).getByText('Volume +25% contra o período anterior'),
    ).toBeInTheDocument();
  });

  it('tema pequeno e resumo só com números explicam o motivo, sem texto do LLM', async () => {
    simularApi({ 'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: RESUMOS } } });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    expect(
      await screen.findByText('O volume ainda é pequeno: 4 comentários neste período.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/mostramos só os números/)).toBeInTheDocument();
  });

  it('só mostra o rótulo de texto gerado por IA onde há texto gerado', async () => {
    simularApi({ 'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: RESUMOS } } });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    await screen.findAllByRole('article');

    expect(screen.getAllByText(/Texto gerado por IA e verificado/)).toHaveLength(2);
  });

  it('abre os comentários que sustentam o achado', async () => {
    simularApi({
      'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: [RESUMOS[0]] } },
      'GET /projetos/p-1/resumos/r-1/achados/0/comentarios': {
        corpo: {
          itens: [
            {
              id: 'k1',
              texto: 'Esperei uma hora na fila.',
              nota: 1,
              unidade: 'Centro',
              comentadoEm: null,
            },
            {
              id: 'k2',
              texto: 'Atendimento muito lento.',
              nota: 2,
              unidade: null,
              comentadoEm: null,
            },
          ],
        },
      },
    });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ver comentários' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Esperei uma hora na fila.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Atendimento muito lento.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Centro · 1/5')).toBeInTheDocument();
  });

  it('sem resumo ainda, convida a gerar e o botão dispara a geração', async () => {
    const chamadas = simularApi({
      'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: [] } },
      'POST /projetos/p-1/resumos': { status: 202, corpo: { trabalhoId: 't-1' } },
    });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    expect(await screen.findByText('Nenhum resumo ainda')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gerar resumo' }));

    await waitFor(() => {
      expect(
        chamadas.some((c) => c.metodo === 'POST' && c.caminho === '/projetos/p-1/resumos'),
      ).toBe(true);
    });
  });

  it('sem comentários classificados, o botão fica desabilitado e a tela explica', async () => {
    simularApi({ 'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: [] } } });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar={false} />);

    expect(
      await screen.findByText('Classifique os comentários para poder gerar o resumo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar resumo' })).toBeDisabled();
  });

  it('durante a geração mostra o andamento e não deixa gerar de novo', async () => {
    simularApi({ 'GET /projetos/p-1/resumos': { corpo: { emAndamento: true, itens: [] } } });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    expect(await screen.findByRole('button', { name: 'Gerando o resumo...' })).toBeDisabled();
  });

  it('não mostra dólar, tokens nem nome de modelo', async () => {
    simularApi({ 'GET /projetos/p-1/resumos': { corpo: { emAndamento: false, itens: RESUMOS } } });
    renderizarComProvedores(<SecaoDeResumos projetoId="p-1" podeGerar />);

    await screen.findAllByRole('article');

    expect(document.body.textContent).not.toMatch(/US\$|USD|dólar|token|modelo|jev|claude/i);
  });
});
