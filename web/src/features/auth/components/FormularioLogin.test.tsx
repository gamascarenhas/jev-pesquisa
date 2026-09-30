import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarUsuario, renderizarComProvedores } from '@/test/renderizar';
import { erroDaApi, simularApi } from '@/test/api-falsa';

import { FormularioLogin } from './FormularioLogin';

function renderizar() {
  renderizarComProvedores(
    <Routes>
      <Route path="/entrar" element={<FormularioLogin />} />
      <Route path="/projetos" element={<p>Tela de projetos</p>} />
    </Routes>,
    { rota: '/entrar' },
  );
}

async function preencher(email: string, senha: string) {
  await userEvent.type(screen.getByLabelText('E-mail'), email);
  await userEvent.type(screen.getByLabelText('Senha'), senha);
  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FormularioLogin', () => {
  it('valida os campos antes de chamar a API', async () => {
    const chamadas = simularApi({});
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(screen.getAllByText('Preencha este campo.')).toHaveLength(2);
    expect(chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(0);
  });

  it('recusa e-mail malformado', async () => {
    simularApi({});
    renderizar();

    await preencher('sem-arroba', 'qualquer-senha');

    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
  });

  it('entra e vai para os projetos quando as credenciais estão certas', async () => {
    const chamadas = simularApi({ 'POST /auth/login': { corpo: criarUsuario() } });
    renderizar();

    await preencher('Ana@Empresa.com.br', 'senha-correta-123');

    expect(await screen.findByText('Tela de projetos')).toBeInTheDocument();
    const login = chamadas.find((chamada) => chamada.caminho === '/auth/login');
    expect(login?.corpo).toEqual({ email: 'ana@empresa.com.br', senha: 'senha-correta-123' });
  });

  it('mostra a mensagem em português para credenciais inválidas', async () => {
    simularApi({ 'POST /auth/login': erroDaApi(401, 'credenciais_invalidas') });
    renderizar();

    await preencher('ana@empresa.com.br', 'senha-errada-123');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('oferece o reenvio quando o e-mail não foi confirmado', async () => {
    simularApi({ 'POST /auth/login': erroDaApi(403, 'email_nao_confirmado') });
    renderizar();

    await preencher('ana@empresa.com.br', 'senha-correta-123');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Reenviar confirmação' })).toBeInTheDocument();
    });
  });

  it('avisa quando o servidor não responde', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('falha')));
    renderizar();

    await preencher('ana@empresa.com.br', 'senha-correta-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não conseguimos falar com o servidor',
    );
  });
});
