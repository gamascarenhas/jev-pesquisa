import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Comentario } from '@/api/types';
import { simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { PainelPage } from './PainelPage';

const DADOS = {
  resumo: { total: 12, classificados: 10, pendentesDeRevisao: 3, notaMedia: 3.5 },
  temas: [
    { tema: 'wait_time', sentimento: 'negative', total: 5 },
    { tema: 'service', sentimento: 'positive', total: 5 },
  ],
  gravidade: [
    { nivel: 0, total: 5 },
    { nivel: 1, total: 2 },
    { nivel: 2, total: 2 },
    { nivel: 3, total: 1 },
  ],
};
const OPCOES = { fontes: [{ id: 'f-1', nome: 'planilha.csv' }], unidades: ['Centro'] };
const COMENTARIO: Comentario = {
  id: 'c-1',
  textoOriginal: 'Fila enorme na loja',
  fonte: 'planilha.csv',
  unidade: 'Centro',
  autor: null,
  comentadoEm: '2024-03-10T15:00:00.000Z',
  nota: 1,
  tema: 'wait_time',
  sentimento: 'negative',
  temaDoModelo: 'wait_time',
  sentimentoDoModelo: 'negative',
  temaConfianca: 0.4,
  sentimentoConfianca: 0.9,
  gravidade: 0.66,
  precisaAcao: true,
  precisaRevisao: true,
  foiRevisado: false,
  status: 'done',
};

function renderizar() {
  renderizarComProvedores(
    <Routes>
      <Route path="/projetos/:projetoId/painel" element={<PainelPage />} />
    </Routes>,
    { rota: '/projetos/p-1/painel' },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PainelPage', () => {
  it('mostra os cartões, os gráficos, a lista com rótulos em português e as ações', async () => {
    simularApi({
      'GET /projetos/p-1/painel': { corpo: DADOS },
      'GET /projetos/p-1/painel/opcoes': { corpo: OPCOES },
      'GET /projetos/p-1/comentarios?pagina=1&tamanhoPagina=10': {
        corpo: { itens: [COMENTARIO], total: 1, pagina: 1, tamanhoPagina: 10 },
      },
    });
    renderizar();

    const cartoes = await screen.findByText('Para revisar');
    expect(cartoes.parentElement?.textContent).toBe('Para revisar3');
    expect(screen.getByText('3,5')).toBeInTheDocument();
    expect(screen.getByText('Comentários por tema e sentimento')).toBeInTheDocument();
    expect(screen.getByText('Gravidade dos problemas')).toBeInTheDocument();
    const tabela = await screen.findByRole('table', { name: 'Comentários' });
    expect(within(tabela).getByText('Fila enorme na loja')).toBeInTheDocument();
    expect(within(tabela).getByText('Negativo')).toBeInTheDocument();
    expect(within(tabela).getByText('40%')).toBeInTheDocument();
    expect(within(tabela).getByText('Precisa de ação')).toBeInTheDocument();
    expect(within(tabela).getByText('Revisar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exportar CSV' })).toHaveAttribute(
      'href',
      '/api/projetos/p-1/exportacao',
    );
    expect(screen.getByRole('link', { name: 'Fila de revisão' })).toHaveAttribute(
      'href',
      '/projetos/p-1/revisao',
    );
  });

  it('um filtro refaz as consultas e o link de exportação leva os mesmos filtros', async () => {
    const chamadas = simularApi({
      'GET /projetos/p-1/painel': { corpo: DADOS },
      'GET /projetos/p-1/painel?tema=price': {
        corpo: { ...DADOS, resumo: { ...DADOS.resumo, total: 2 } },
      },
      'GET /projetos/p-1/painel/opcoes': { corpo: OPCOES },
      'GET /projetos/p-1/comentarios?pagina=1&tamanhoPagina=10': {
        corpo: { itens: [COMENTARIO], total: 1, pagina: 1, tamanhoPagina: 10 },
      },
      'GET /projetos/p-1/comentarios?tema=price&pagina=1&tamanhoPagina=10': {
        corpo: { itens: [], total: 0, pagina: 1, tamanhoPagina: 10 },
      },
    });
    renderizar();

    await userEvent.selectOptions(await screen.findByLabelText('Tema'), 'Preço');

    expect(
      await screen.findByText('Nenhum comentário encontrado com estes filtros.'),
    ).toBeInTheDocument();
    expect(chamadas.some((c) => c.caminho === '/projetos/p-1/painel?tema=price')).toBe(true);
    expect(screen.getByRole('link', { name: 'Exportar CSV' })).toHaveAttribute(
      'href',
      '/api/projetos/p-1/exportacao?tema=price',
    );
  });

  it('sem nada classificado, explica o próximo passo em vez de mostrar gráficos vazios', async () => {
    simularApi({
      'GET /projetos/p-1/painel': {
        corpo: {
          ...DADOS,
          resumo: { total: 0, classificados: 0, pendentesDeRevisao: 0, notaMedia: null },
        },
      },
      'GET /projetos/p-1/painel/opcoes': { corpo: { fontes: [], unidades: [] } },
    });
    renderizar();

    expect(await screen.findByText('Ainda não há comentários classificados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Classificar comentários' })).toHaveAttribute(
      'href',
      '/projetos/p-1/classificar',
    );
    expect(screen.queryByText('Comentários por tema e sentimento')).not.toBeInTheDocument();
  });
});
