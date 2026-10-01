import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { calcularPassoAtual } from '../hooks/use-estado-do-onboarding';
import { PrimeirosPassosPage } from './PrimeirosPassosPage';

const PROJETO = {
  id: 'p-1',
  nome: 'Loja Centro',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
};
const LISTA = '/projetos?pagina=1&tamanhoPagina=20';

function progresso(classificados: number, pendentes: number, falhos = 0) {
  return { pendentes, classificados, falhos, semTexto: 0, trabalho: null };
}

function api(projetos: unknown[], andamento = progresso(0, 0)) {
  return simularApi({
    [`GET ${LISTA}`]: {
      corpo: { itens: projetos, total: projetos.length, pagina: 1, tamanhoPagina: 20 },
    },
    'GET /projetos/p-1/classificacao/progresso': { corpo: andamento },
  });
}

function passoAtual(): HTMLElement {
  const atual = document.querySelector('[aria-current="step"]');
  if (!(atual instanceof HTMLElement)) {
    throw new Error('Nenhum passo atual.');
  }
  return atual;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('calcularPassoAtual', () => {
  it('sai dos dados que já existem', () => {
    expect(calcularPassoAtual(undefined, undefined)).toBe(1);
    expect(calcularPassoAtual(PROJETO, progresso(0, 0))).toBe(2);
    expect(calcularPassoAtual(PROJETO, progresso(0, 10))).toBe(4);
    expect(calcularPassoAtual(PROJETO, progresso(5, 5))).toBe(4);
    expect(calcularPassoAtual(PROJETO, progresso(10, 0, 2))).toBe(5);
  });
});

describe('PrimeirosPassosPage', () => {
  it('sem projeto, o passo 1 pede o nome do primeiro projeto e mostra o progresso', async () => {
    api([]);
    renderizarComProvedores(<PrimeirosPassosPage />);

    expect(await screen.findByText('Passo 1 de 5 · 4 passos restantes')).toBeInTheDocument();
    const atual = within(passoAtual());
    expect(atual.getByText('1. Crie seu primeiro projeto')).toBeInTheDocument();
    expect(atual.getByLabelText('Nome do primeiro projeto')).toBeInTheDocument();
    expect(document.querySelectorAll('li')).toHaveLength(5);
  });

  it('cria o projeto pelo próprio passo a passo', async () => {
    const chamadas = simularApi({
      [`GET ${LISTA}`]: { corpo: { itens: [], total: 0, pagina: 1, tamanhoPagina: 20 } },
      'POST /projetos': { status: 201, corpo: PROJETO },
    });
    renderizarComProvedores(<PrimeirosPassosPage />);

    await userEvent.type(await screen.findByLabelText('Nome do primeiro projeto'), 'Loja Centro');
    await userEvent.click(screen.getByRole('button', { name: 'Criar projeto' }));

    await screen.findByText('Passo 1 de 5 · 4 passos restantes');
    expect(chamadas.find((c) => c.metodo === 'POST')?.corpo).toEqual({ nome: 'Loja Centro' });
  });

  it('com projeto e sem comentários, o passo 2 oferece a planilha e o arquivo de exemplo', async () => {
    api([PROJETO]);
    renderizarComProvedores(<PrimeirosPassosPage />);

    expect(await screen.findByText('Passo 2 de 5 · 3 passos restantes')).toBeInTheDocument();
    const atual = within(passoAtual());
    expect(atual.getByRole('link', { name: 'Enviar planilha' })).toHaveAttribute(
      'href',
      '/projetos/p-1/importar',
    );
    expect(atual.getByRole('link', { name: 'Baixar arquivo de exemplo' })).toHaveAttribute(
      'href',
      '/exemplo-comentarios.csv',
    );
    expect(
      atual.getByRole('link', { name: 'Conectar o Perfil da Empresa no Google' }),
    ).toHaveAttribute('href', '/projetos/p-1/google');
  });

  it('com comentários esperando, o passo 4 leva à classificação', async () => {
    api([PROJETO], progresso(0, 100));
    renderizarComProvedores(<PrimeirosPassosPage />);

    expect(await screen.findByText('Passo 4 de 5 · 1 passos restantes')).toBeInTheDocument();
    expect(within(passoAtual()).getByRole('link', { name: 'Classificar' })).toHaveAttribute(
      'href',
      '/projetos/p-1/classificar',
    );
  });

  it('com tudo classificado, o último passo abre o painel e os anteriores aparecem como feitos', async () => {
    api([PROJETO], progresso(100, 0));
    renderizarComProvedores(<PrimeirosPassosPage />);

    expect(await screen.findByText('Passo 5 de 5 · 0 passos restantes')).toBeInTheDocument();
    expect(within(passoAtual()).getByRole('link', { name: 'Abrir o painel' })).toHaveAttribute(
      'href',
      '/projetos/p-1/painel',
    );
    expect(screen.getAllByText('Feito')).toHaveLength(4);
  });
});
