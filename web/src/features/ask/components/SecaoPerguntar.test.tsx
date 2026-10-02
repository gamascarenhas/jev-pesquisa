import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PerguntaDetalhada } from '@/api/types';
import { simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { SecaoPerguntar } from './SecaoPerguntar';

function pergunta(sobrescritas: Partial<PerguntaDetalhada> = {}): PerguntaDetalhada {
  return {
    id: 'q-1',
    texto: 'Quem reclamou da fila?',
    status: 'awaiting_confirmation',
    respondivel: true,
    interpretacao: 'Procuro quem reclamou da espera.',
    motivoNaoRespondivel: null,
    filtros: {},
    criadoEm: '2026-04-01T12:00:00.000Z',
    progresso: { feito: 0, total: 14 },
    confirmacao: {
      totalAvaliar: 14,
      foraDoLimite: 0,
      jaRespondidos: 0,
      porcentagemEstimada: 0.4,
      porcentagemJaConsumida: 10,
      cabe: true,
    },
    ...sobrescritas,
  };
}

const PRONTA = pergunta({ status: 'done', confirmacao: null, progresso: { feito: 14, total: 14 } });
const RESULTADO_YES =
  'GET /projetos/p-1/perguntas/q-1/resultado?faixa=yes&pagina=1&tamanhoPagina=10';

const RESULTADO = {
  contagens: { sim: 6, incerto: 3, nao: 5 },
  total: 6,
  pagina: 1,
  tamanhoPagina: 10,
  itens: [
    {
      id: 'c-1',
      texto: 'Esperei muito na fila.',
      fonte: 'Planilha',
      unidade: 'Centro',
      autor: null,
      comentadoEm: null,
      nota: 2,
      tema: 'wait_time',
      sentimento: 'negative',
      probabilidade: 0.93,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function perguntar(texto = 'Quem reclamou da fila?') {
  await userEvent.type(screen.getByLabelText('Pergunte sobre estes comentários'), texto);
  await userEvent.click(screen.getByRole('button', { name: 'Perguntar' }));
}

function apiComPerguntaAguardando(extras: Record<string, object> = {}) {
  return simularApi({
    'GET /projetos/p-1/perguntas': { corpo: { itens: [] } },
    'POST /projetos/p-1/perguntas': { corpo: pergunta() },
    'GET /projetos/p-1/perguntas/q-1': { corpo: pergunta() },
    ...extras,
  });
}

describe('perguntar ao Jev', () => {
  it('mostra os limites da interpretação logo abaixo do campo', () => {
    simularApi({ 'GET /projetos/p-1/perguntas': { corpo: { itens: [] } } });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);

    expect(screen.getByText(/indicam probabilidade, não certeza/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perguntar' })).toBeDisabled();
  });

  it('envia a pergunta com os filtros atuais e mostra a confirmação com a estimativa, sem rodar nada', async () => {
    const chamadas = apiComPerguntaAguardando();
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{ unidade: 'Centro' }} />);

    await perguntar();

    expect(await screen.findByText('Procuro quem reclamou da espera.')).toBeInTheDocument();
    expect(screen.getByText('14 comentários serão avaliados.')).toBeInTheDocument();
    expect(screen.getByText('Deve consumir cerca de 0,4% do seu plano.')).toBeInTheDocument();
    const envio = chamadas.find((c) => c.metodo === 'POST');
    expect(envio?.corpo).toEqual({
      texto: 'Quem reclamou da fila?',
      filtros: { unidade: 'Centro' },
    });
    expect(chamadas.some((c) => c.caminho.endsWith('/confirmar'))).toBe(false);
  });

  it('só confirma quando o usuário clica em confirmar', async () => {
    const chamadas = apiComPerguntaAguardando({
      'POST /projetos/p-1/perguntas/q-1/confirmar': { status: 202, corpo: { trabalhoId: 't-1' } },
    });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);
    await perguntar();

    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar e perguntar' }));

    await waitFor(() => {
      expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho.endsWith('/confirmar'))).toBe(
        true,
      );
    });
  });

  it('avisa quando o consumo estimado passa do que resta e quando o filtro excede o limite', async () => {
    const excedida = pergunta({
      confirmacao: {
        totalAvaliar: 5000,
        foraDoLimite: 1200,
        jaRespondidos: 40,
        porcentagemEstimada: 120,
        porcentagemJaConsumida: 10,
        cabe: false,
      },
    });
    simularApi({
      'GET /projetos/p-1/perguntas': { corpo: { itens: [] } },
      'POST /projetos/p-1/perguntas': { corpo: excedida },
      'GET /projetos/p-1/perguntas/q-1': { corpo: excedida },
    });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);
    await perguntar();

    expect(await screen.findByText(/passa do que resta no plano/)).toBeInTheDocument();
    expect(
      screen.getByText(/1\.200 comentários do filtro atual ficaram de fora/),
    ).toBeInTheDocument();
    expect(screen.getByText(/40 já têm resposta/)).toBeInTheDocument();
  });

  it('pergunta não respondível mostra o motivo e não oferece confirmar', async () => {
    const naoRespondivel = pergunta({
      status: 'not_answerable',
      respondivel: false,
      motivoNaoRespondivel: 'Use os filtros do painel.',
      confirmacao: null,
    });
    simularApi({
      'GET /projetos/p-1/perguntas': { corpo: { itens: [] } },
      'POST /projetos/p-1/perguntas': { corpo: naoRespondivel },
      'GET /projetos/p-1/perguntas/q-1': { corpo: naoRespondivel },
    });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);
    await perguntar('Calcule a média');

    expect(await screen.findByText('Use os filtros do painel.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar e perguntar' })).not.toBeInTheDocument();
  });

  it('com a pergunta pronta, mostra o contador, as faixas e a exportação', async () => {
    simularApi({
      'GET /projetos/p-1/perguntas': { corpo: { itens: [PRONTA] } },
      'GET /projetos/p-1/perguntas/q-1': { corpo: PRONTA },
      [RESULTADO_YES]: { corpo: RESULTADO },
    });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);

    await userEvent.click(await screen.findByRole('button', { name: /^Abrir: / }));

    expect(
      await screen.findByText('6 de 14 comentários provavelmente respondem sim.'),
    ).toBeInTheDocument();
    const abas = screen.getAllByRole('tab');
    expect(abas.map((a) => a.textContent)).toEqual([
      'Provavelmente sim (6)',
      'Incerto (3)',
      'Provavelmente não (5)',
    ]);
    expect(abas[0]).toHaveAttribute('aria-selected', 'true');
    const painel = screen.getByRole('tabpanel');
    expect(within(painel).getByText('Esperei muito na fila.')).toBeInTheDocument();
    expect(within(painel).getByText('93% de chance')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exportar CSV' })).toHaveAttribute(
      'href',
      '/api/projetos/p-1/perguntas/q-1/exportacao?faixa=yes',
    );
  });

  it('o histórico lista as perguntas recentes para reabrir', async () => {
    simularApi({
      'GET /projetos/p-1/perguntas': {
        corpo: {
          itens: [pergunta({ id: 'q-1' }), pergunta({ id: 'q-2', texto: 'Quem elogiou o preço?' })],
        },
      },
    });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);

    expect(await screen.findByText('Perguntas recentes')).toBeInTheDocument();
    expect(screen.getByText(/Quem elogiou o preço\?/)).toBeInTheDocument();
  });

  it('não mostra dólar, tokens nem nome de modelo', async () => {
    simularApi({
      'GET /projetos/p-1/perguntas': { corpo: { itens: [PRONTA] } },
      'GET /projetos/p-1/perguntas/q-1': { corpo: PRONTA },
      [RESULTADO_YES]: { corpo: RESULTADO },
    });
    renderizarComProvedores(<SecaoPerguntar projetoId="p-1" filtros={{}} />);
    await userEvent.click(await screen.findByRole('button', { name: /^Abrir: / }));
    await screen.findByRole('tabpanel');

    expect(document.body.textContent).not.toMatch(/US\$|USD|dólar|token|modelo|jev-|claude/i);
  });
});
