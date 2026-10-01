import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Comentario } from '@/api/types';
import { erroDaApi, simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { FilaDeRevisaoPage } from './FilaDeRevisaoPage';

const COMENTARIO: Comentario = {
  id: 'c-1',
  textoOriginal: 'Fila enorme na loja',
  fonte: 'planilha.csv',
  unidade: 'Centro',
  autor: null,
  comentadoEm: null,
  nota: 1,
  tema: 'wait_time',
  sentimento: 'negative',
  temaDoModelo: 'wait_time',
  sentimentoDoModelo: 'negative',
  temaConfianca: 0.4,
  sentimentoConfianca: 0.9,
  gravidade: 0.6,
  precisaAcao: true,
  precisaRevisao: true,
  foiRevisado: false,
  status: 'done',
};

const FILA = '/projetos/p-1/revisao?pagina=1&tamanhoPagina=10';

function renderizar() {
  renderizarComProvedores(
    <Routes>
      <Route path="/projetos/:projetoId/revisao" element={<FilaDeRevisaoPage />} />
    </Routes>,
    { rota: '/projetos/p-1/revisao' },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FilaDeRevisaoPage', () => {
  it('mostra o comentário original e o que o modelo sugeriu', async () => {
    simularApi({
      [`GET ${FILA}`]: { corpo: { itens: [COMENTARIO], total: 1, pagina: 1, tamanhoPagina: 10 } },
    });
    renderizar();

    expect(await screen.findByText('Fila enorme na loja')).toBeInTheDocument();
    expect(screen.getByText('O modelo sugeriu: Tempo de espera, Negativo')).toBeInTheDocument();
    expect(screen.getByLabelText('Tema')).toHaveValue('wait_time');
    expect(screen.getByLabelText('Sentimento')).toHaveValue('negative');
  });

  it('corrige tema e sentimento, grava a correção e o comentário sai da fila', async () => {
    let corrigido = false;
    const chamadas = simularApi({
      [`GET ${FILA}`]: () => ({
        corpo: corrigido
          ? { itens: [], total: 0, pagina: 1, tamanhoPagina: 10 }
          : { itens: [COMENTARIO], total: 1, pagina: 1, tamanhoPagina: 10 },
      }),
      'PUT /projetos/p-1/comentarios/c-1/revisao': () => {
        corrigido = true;
        return { status: 204 };
      },
    });
    renderizar();

    await userEvent.selectOptions(await screen.findByLabelText('Tema'), 'Atendimento');
    await userEvent.selectOptions(screen.getByLabelText('Sentimento'), 'Misto');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    await waitFor(() => {
      expect(screen.getByText('Nada para revisar')).toBeInTheDocument();
    });
    const envio = chamadas.find((chamada) => chamada.metodo === 'PUT');
    expect(envio?.corpo).toEqual({ tema: 'service', sentimento: 'mixed' });
    expect(screen.getByText('Correção salva. O comentário saiu da fila.')).toBeInTheDocument();
  });

  it('mostra o erro em português quando a correção é recusada', async () => {
    simularApi({
      [`GET ${FILA}`]: { corpo: { itens: [COMENTARIO], total: 1, pagina: 1, tamanhoPagina: 10 } },
      'PUT /projetos/p-1/comentarios/c-1/revisao': erroDaApi(400, 'classificacao_invalida'),
    });
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Salvar correção' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Escolha um tema e um sentimento da lista.',
    );
    expect(screen.getByText('Fila enorme na loja')).toBeInTheDocument();
  });

  it('explica o próximo passo quando a fila está vazia', async () => {
    simularApi({
      [`GET ${FILA}`]: { corpo: { itens: [], total: 0, pagina: 1, tamanhoPagina: 10 } },
    });
    renderizar();

    expect(await screen.findByText('Nada para revisar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao painel' })).toHaveAttribute(
      'href',
      '/projetos/p-1/painel',
    );
  });
});
