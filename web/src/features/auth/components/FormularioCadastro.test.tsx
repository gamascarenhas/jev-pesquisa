import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { erroDaApi, simularApi } from '@/test/api-falsa';
import { renderizarComProvedores } from '@/test/renderizar';

import { FormularioCadastro } from './FormularioCadastro';

async function preencherCampos(senha = 'uma-senha-longa-123') {
  await userEvent.type(screen.getByLabelText('Nome da empresa'), 'Loja Centro');
  await userEvent.type(screen.getByLabelText('Seu nome'), 'Ana Souza');
  await userEvent.type(screen.getByLabelText('E-mail'), 'ana@empresa.com.br');
  await userEvent.type(screen.getByLabelText('Senha'), senha);
}

function enviar() {
  return userEvent.click(screen.getByRole('button', { name: 'Criar conta' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FormularioCadastro', () => {
  it('exige todos os campos e o aceite dos termos', async () => {
    const chamadas = simularApi({});
    renderizarComProvedores(<FormularioCadastro aoConcluir={vi.fn()} />);

    await enviar();

    expect(screen.getAllByText('Preencha este campo.').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Aceite os termos e a política para continuar.')).toBeInTheDocument();
    expect(chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(0);
  });

  it('não envia sem o aceite, mesmo com os outros campos certos', async () => {
    const chamadas = simularApi({});
    renderizarComProvedores(<FormularioCadastro aoConcluir={vi.fn()} />);

    await preencherCampos();
    await enviar();

    expect(screen.getByText('Aceite os termos e a política para continuar.')).toBeInTheDocument();
    expect(chamadas.filter((chamada) => chamada.caminho === '/auth/cadastro')).toHaveLength(0);
  });

  it('recusa senha curta com o mínimo no texto', async () => {
    simularApi({});
    renderizarComProvedores(<FormularioCadastro aoConcluir={vi.fn()} />);

    await preencherCampos('curta');
    await userEvent.click(screen.getByRole('checkbox'));
    await enviar();

    expect(screen.getByText('A senha precisa ter pelo menos 10 caracteres.')).toBeInTheDocument();
  });

  it('envia o aceite e chama aoConcluir quando o cadastro passa', async () => {
    const chamadas = simularApi({
      'POST /auth/cadastro': { status: 202, corpo: { mensagem: 'ok' } },
    });
    const aoConcluir = vi.fn();
    renderizarComProvedores(<FormularioCadastro aoConcluir={aoConcluir} />);

    await preencherCampos();
    await userEvent.click(screen.getByRole('checkbox'));
    await enviar();

    await vi.waitFor(() => {
      expect(aoConcluir).toHaveBeenCalledTimes(1);
    });
    const cadastro = chamadas.find((chamada) => chamada.caminho === '/auth/cadastro');
    expect(cadastro?.corpo).toEqual({
      nomeEmpresa: 'Loja Centro',
      nomeUsuario: 'Ana Souza',
      email: 'ana@empresa.com.br',
      senha: 'uma-senha-longa-123',
      aceiteTermos: true,
    });
  });

  it('mostra erro da API em português', async () => {
    simularApi({ 'POST /auth/cadastro': erroDaApi(429, 'muitas_requisicoes') });
    renderizarComProvedores(<FormularioCadastro aoConcluir={vi.fn()} />);

    await preencherCampos();
    await userEvent.click(screen.getByRole('checkbox'));
    await enviar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas');
  });

  it('linka os termos e a política, que abrem sem login', () => {
    simularApi({});
    renderizarComProvedores(<FormularioCadastro aoConcluir={vi.fn()} />);

    expect(screen.getByRole('link', { name: 'Termos de uso' })).toHaveAttribute('href', '/termos');
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    );
  });
});
