import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { simularApi } from '@/test/api-falsa';
import { criarUsuario, renderizarComProvedores } from '@/test/renderizar';

import { GooglePage } from './GooglePage';

const STATUS_DESCONECTADO = {
  conectado: false,
  email: null,
  simulado: true,
  sincronizando: false,
  unidades: [],
};

const STATUS_CONECTADO = {
  conectado: true,
  email: 'conta-simulada@exemplo.com.br',
  simulado: true,
  sincronizando: false,
  unidades: [],
};

const CONTAS = {
  itens: [
    {
      id: 'accounts/1',
      nome: 'Rede Exemplo',
      unidades: [
        {
          nome: 'accounts/1/locations/10',
          titulo: 'Loja Centro',
          endereco: 'Rua A, 1',
          selecionada: false,
        },
        { nome: 'accounts/1/locations/11', titulo: 'Loja Sul', endereco: null, selecionada: false },
      ],
    },
  ],
};

function api(papel: 'owner' | 'member', status: object, extras: Record<string, object> = {}) {
  return simularApi({
    'GET /auth/eu': { corpo: criarUsuario({ papel }) },
    'GET /projetos/p-1/google': { corpo: status },
    ...Object.fromEntries(Object.entries(extras).map(([chave, corpo]) => [chave, { corpo }])),
  });
}

function renderizar(rota = '/projetos/p-1/google') {
  return renderizarComProvedores(
    <Routes>
      <Route path="/projetos/:projetoId/google" element={<GooglePage />} />
    </Routes>,
    { rota },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('conexão com o Google', () => {
  it('o owner conecta e é levado à página de autorização devolvida pelo servidor', async () => {
    const atribuir = vi.fn();
    vi.stubGlobal('location', { assign: atribuir });
    const chamadas = api('owner', STATUS_DESCONECTADO, {
      'POST /projetos/p-1/google/conectar': { url: 'https://accounts.google.com/auth?state=x' },
    });
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Conectar com o Google' }));

    await waitFor(() => {
      expect(atribuir).toHaveBeenCalledWith('https://accounts.google.com/auth?state=x');
    });
    expect(chamadas.some((c) => c.metodo === 'POST' && c.caminho.endsWith('/conectar'))).toBe(true);
  });

  it('o member não vê o botão de conectar', async () => {
    api('member', STATUS_DESCONECTADO);
    renderizar();

    expect(
      await screen.findByText('Só o dono da conta pode conectar ou desconectar o Google.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar com o Google' })).not.toBeInTheDocument();
  });

  it('explica o erro devolvido pelo callback', async () => {
    api('owner', STATUS_DESCONECTADO);
    renderizar('/projetos/p-1/google?erro=google_negado');

    expect(await screen.findByText('A conexão foi cancelada no Google.')).toBeInTheDocument();
  });

  it('conectado, mostra o e-mail e o aviso de modo simulado', async () => {
    api('owner', STATUS_CONECTADO, { 'GET /projetos/p-1/google/unidades': CONTAS });
    renderizar();

    expect(
      await screen.findByText('Conectado como conta-simulada@exemplo.com.br'),
    ).toBeInTheDocument();
    expect(screen.getByText('Modo simulado: os dados são fictícios.')).toBeInTheDocument();
  });
});

describe('escolha de unidades', () => {
  it('lista as unidades, exige ao menos uma e envia as escolhidas', async () => {
    const chamadas = api('owner', STATUS_CONECTADO, {
      'GET /projetos/p-1/google/unidades': CONTAS,
      'PUT /projetos/p-1/google/unidades': { trabalhoId: 't-1' },
    });
    renderizar();

    const botao = await screen.findByRole('button', { name: 'Importar unidades escolhidas' });
    expect(botao).toBeDisabled();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Loja Centro' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Loja Sul' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Loja Sul' }));
    await userEvent.click(botao);

    await waitFor(() => {
      expect(chamadas.find((c) => c.metodo === 'PUT')?.corpo).toEqual({
        unidades: ['accounts/1/locations/10'],
      });
    });
    expect(screen.getByText('Rua A, 1')).toBeInTheDocument();
  });

  it('o member não vê a escolha de unidades', async () => {
    api('member', STATUS_CONECTADO);
    renderizar();

    await screen.findByText('Conectado como conta-simulada@exemplo.com.br');
    expect(screen.queryByText('Unidades para importar')).not.toBeInTheDocument();
  });
});

describe('sincronização', () => {
  it('mostra a última sincronização e a mensagem de falha explicando a cota do Google', async () => {
    api(
      'owner',
      {
        ...STATUS_CONECTADO,
        unidades: [
          {
            nomeUnidade: 'accounts/1/locations/10',
            titulo: 'Loja Centro',
            ultimaSincronizacaoEm: null,
            falha: { codigo: 'google_sem_acesso', mensagem: 'O acesso ainda não foi aprovado.' },
          },
        ],
      },
      { 'GET /projetos/p-1/google/unidades': CONTAS },
    );
    renderizar();

    expect(await screen.findByText('Ainda não sincronizada')).toBeInTheDocument();
    expect(screen.getByText('O acesso ainda não foi aprovado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sincronizar agora' })).toBeInTheDocument();
  });
});
