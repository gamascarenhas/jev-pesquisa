import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NavegacaoLateral } from '@/components/layout/NavegacaoLateral';
import { ProjetosPage } from '@/features/projects/pages/ProjetosPage';
import { simularApi } from '@/test/api-falsa';
import { criarUsuario, renderizarComProvedores } from '@/test/renderizar';

import { DadosEContaPage } from './pages/DadosEContaPage';
import { UsuariosPage } from './pages/UsuariosPage';

const PROJETO = {
  id: 'projeto-1',
  nome: 'Loja Centro',
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
};

function apiComUsuario(papel: 'owner' | 'member') {
  return simularApi({
    'GET /auth/eu': { corpo: criarUsuario({ papel }) },
    'GET /projetos?pagina=1&tamanhoPagina=20': {
      corpo: { itens: [PROJETO], total: 1, pagina: 1, tamanhoPagina: 20 },
    },
    'GET /usuarios': { corpo: { itens: [criarUsuario()] } },
    'GET /conta': {
      corpo: { id: 'c', nome: 'Loja', plano: { id: 't', nome: 'Teste' }, cicloTerminaEm: '' },
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ações exclusivas do owner', () => {
  it('o owner vê as áreas de configuração e o member não', () => {
    simularApi({});
    const { unmount } = renderizarComProvedores(
      <NavegacaoLateral aberta={false} ehDono aoNavegar={vi.fn()} />,
    );
    expect(screen.getByRole('link', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Convites' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dados e conta' })).toBeInTheDocument();
    unmount();

    renderizarComProvedores(<NavegacaoLateral aberta={false} ehDono={false} aoNavegar={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Convites' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dados e conta' })).not.toBeInTheDocument();
  });

  it('o member não vê o botão de apagar projeto, mas pode renomear', async () => {
    apiComUsuario('member');
    renderizarComProvedores(<ProjetosPage />);

    expect(await screen.findByRole('button', { name: 'Renomear' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apagar projeto' })).not.toBeInTheDocument();
  });

  it('o owner vê o botão de apagar projeto', async () => {
    apiComUsuario('owner');
    renderizarComProvedores(<ProjetosPage />);

    expect(await screen.findByRole('button', { name: 'Apagar projeto' })).toBeInTheDocument();
  });

  it('o member não vê nem busca a lista de usuários', async () => {
    const chamadas = apiComUsuario('member');
    renderizarComProvedores(
      <Routes>
        <Route path="/" element={<UsuariosPage />} />
      </Routes>,
    );

    expect(await screen.findByText('Só o dono da conta vê esta área.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(chamadas.some((chamada) => chamada.caminho === '/usuarios')).toBe(false);
  });

  it('o member não vê o encerramento de conta', async () => {
    apiComUsuario('member');
    renderizarComProvedores(<DadosEContaPage />);

    expect(await screen.findByText('Só o dono da conta vê esta área.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Encerrar conta' })).not.toBeInTheDocument();
  });

  it('o owner vê a lista de usuários e o encerramento de conta', async () => {
    apiComUsuario('owner');
    const { unmount } = renderizarComProvedores(<UsuariosPage />);
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    unmount();

    renderizarComProvedores(<DadosEContaPage />);
    expect(await screen.findByRole('button', { name: 'Encerrar conta' })).toBeInTheDocument();
  });
});
