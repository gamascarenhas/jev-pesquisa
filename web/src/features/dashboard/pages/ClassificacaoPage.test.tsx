import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { erroDaApi, simularApi } from '@/test/api-falsa';
import { criarUsuario, renderizarComProvedores } from '@/test/renderizar';

import { ClassificacaoPage } from './ClassificacaoPage';

const BASE = '/projetos/p-1/classificacao';
const ESTIMATIVA = {
  pendentes: 1_250,
  minutosEstimados: 3,
  porcentagemEstimada: 12.5,
  porcentagemJaConsumida: 40,
  cabe: true,
};

function progresso(sobrescritas: Record<string, unknown> = {}) {
  return {
    pendentes: 1_250,
    classificados: 0,
    falhos: 0,
    semTexto: 0,
    trabalho: null,
    ...sobrescritas,
  };
}

function renderizar() {
  renderizarComProvedores(
    <Routes>
      <Route path="/projetos/:projetoId/classificar" element={<ClassificacaoPage />} />
    </Routes>,
    { rota: '/projetos/p-1/classificar' },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ClassificacaoPage', () => {
  it('mostra a estimativa do plano em porcentagem e o tempo estimado, sem dólar nem tokens', async () => {
    simularApi({
      'GET /auth/eu': { corpo: criarUsuario() },
      [`GET ${BASE}/estimativa`]: { corpo: ESTIMATIVA },
      [`GET ${BASE}/progresso`]: { corpo: progresso() },
    });
    renderizar();

    expect(await screen.findByText('12,5% do plano')).toBeInTheDocument();
    expect(screen.getByText('cerca de 3 min')).toBeInTheDocument();
    expect(screen.getByText('1.250')).toBeInTheDocument();
    expect(screen.getByText('Você já usou 40% do plano neste ciclo.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/US\$|\$|token|jev-/i);
  });

  it('avisa quando o trabalho não cabe no que resta do plano', async () => {
    simularApi({
      'GET /auth/eu': { corpo: criarUsuario() },
      [`GET ${BASE}/estimativa`]: { corpo: { ...ESTIMATIVA, cabe: false } },
      [`GET ${BASE}/progresso`]: { corpo: progresso() },
    });
    renderizar();

    expect(await screen.findByText(/não cabe no que resta do plano/)).toBeInTheDocument();
  });

  it('inicia a classificação e acompanha o andamento', async () => {
    let iniciada = false;
    const chamadas = simularApi({
      'GET /auth/eu': { corpo: criarUsuario() },
      [`GET ${BASE}/estimativa`]: { corpo: ESTIMATIVA },
      [`GET ${BASE}/progresso`]: () => ({
        corpo: iniciada
          ? progresso({
              pendentes: 900,
              classificados: 350,
              trabalho: { id: 't-1', status: 'running' },
            })
          : progresso(),
      }),
      [`POST ${BASE}`]: () => {
        iniciada = true;
        return { status: 202, corpo: { trabalhoId: 't-1', status: 'pending', jaExistia: false } };
      },
    });
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar classificação' }));

    expect(await screen.findByText('350 classificados, 900 faltando.')).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho === BASE)).toBe(true);
    expect(screen.queryByRole('button', { name: 'Iniciar classificação' })).not.toBeInTheDocument();
  });

  it('usuário sem e-mail confirmado vê o aviso e não consegue iniciar', async () => {
    const chamadas = simularApi({
      'GET /auth/eu': { corpo: criarUsuario({ emailConfirmado: false }) },
      [`GET ${BASE}/progresso`]: { corpo: progresso() },
    });
    renderizar();

    const botao = await screen.findByRole('button', { name: 'Iniciar classificação' });

    expect(screen.getByText(/Confirme seu e-mail para classificar/)).toBeInTheDocument();
    expect(botao).toBeDisabled();
    expect(chamadas.some((c) => c.caminho.endsWith('/estimativa'))).toBe(false);
  });

  it('mostra as falhas e reprocessa', async () => {
    const chamadas = simularApi({
      'GET /auth/eu': { corpo: criarUsuario() },
      [`GET ${BASE}/progresso`]: {
        corpo: progresso({ pendentes: 0, classificados: 90, falhos: 10 }),
      },
      [`POST ${BASE}/reprocessar-falhas`]: {
        status: 202,
        corpo: { trabalhoId: 't-2', status: 'pending', jaExistia: false },
      },
    });
    renderizar();

    expect(
      await screen.findByText('10 comentários não puderam ser classificados.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reprocessar falhas' }));

    expect(
      chamadas.some((c) => c.metodo === 'POST' && c.caminho.endsWith('/reprocessar-falhas')),
    ).toBe(true);
  });

  it('explica a pausa por limite do plano', async () => {
    simularApi({
      'GET /auth/eu': { corpo: criarUsuario() },
      [`GET ${BASE}/estimativa`]: { corpo: ESTIMATIVA },
      [`GET ${BASE}/progresso`]: {
        corpo: progresso({ trabalho: { id: 't-1', status: 'paused_limit' }, classificados: 10 }),
      },
    });
    renderizar();

    expect(
      await screen.findByText(/o plano chegou ao limite e continua sozinha/),
    ).toBeInTheDocument();
  });

  it('traduz o erro de e-mail não confirmado devolvido pelo servidor', async () => {
    simularApi({
      'GET /auth/eu': { corpo: criarUsuario() },
      [`GET ${BASE}/estimativa`]: { corpo: ESTIMATIVA },
      [`GET ${BASE}/progresso`]: { corpo: progresso() },
      [`POST ${BASE}`]: erroDaApi(403, 'email_nao_confirmado'),
    });
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar classificação' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Confirme seu e-mail para continuar.',
    );
  });
});
