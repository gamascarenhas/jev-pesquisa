import { afterEach, describe, expect, it } from 'vitest';

import { LIMITES } from '../../../src/http/plugins/limite-requisicoes.plugin.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import { criarContaComDonoDeTeste, criarEnviadorEmMemoria } from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

interface Rota {
  nome: string;
  url: string;
  regras: { porIp: { max: number }; porEmail: { max: number } };
  corpo: (email: string) => Record<string, unknown>;
}

const ROTAS_PUBLICAS: Rota[] = [
  {
    nome: 'cadastro',
    url: '/api/auth/cadastro',
    regras: LIMITES.cadastro,
    corpo: (email) => ({
      nomeEmpresa: 'Empresa',
      nomeUsuario: 'Nome',
      email,
      senha: 'senha-longa-123',
      aceiteTermos: true,
    }),
  },
  {
    nome: 'reenvio de confirmação',
    url: '/api/auth/reenviar-confirmacao',
    regras: LIMITES.reenvioConfirmacao,
    corpo: (email) => ({ email }),
  },
  {
    nome: 'redefinição de senha',
    url: '/api/auth/esqueci-senha',
    regras: LIMITES.redefinicaoSenha,
    corpo: (email) => ({ email }),
  },
];

const aplicacoes: AppDeTeste[] = [];

async function montar(): Promise<AppDeTeste> {
  const aplicacao = await montarAppDeTeste({ enviadorDeEmail: criarEnviadorEmMemoria() });
  aplicacoes.push(aplicacao);
  return aplicacao;
}

afterEach(async () => {
  await Promise.all(aplicacoes.splice(0).map((aplicacao) => aplicacao.encerrar()));
});

describe.each(ROTAS_PUBLICAS)('limite de $nome', (rota) => {
  it('estourar o limite por IP responde 429', async () => {
    const aplicacao = await montar();
    const respostas: number[] = [];

    for (let i = 0; i <= rota.regras.porIp.max; i += 1) {
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: rota.url,
        corpo: rota.corpo(`ip-${String(i)}@exemplo.com.br`),
        ip: '10.1.1.1',
      });
      respostas.push(resposta.statusCode);
    }

    expect(respostas.slice(0, -1).every((status) => status < 400)).toBe(true);
    expect(respostas.at(-1)).toBe(429);
  });

  it('estourar o limite por e-mail responde 429, mesmo trocando de IP', async () => {
    const aplicacao = await montar();
    const respostas: number[] = [];

    for (let i = 0; i <= rota.regras.porEmail.max; i += 1) {
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: rota.url,
        corpo: rota.corpo('alvo@exemplo.com.br'),
        ip: `10.2.2.${String(i + 1)}`,
      });
      respostas.push(resposta.statusCode);
    }

    expect(respostas.slice(0, -1).every((status) => status < 400)).toBe(true);
    expect(respostas.at(-1)).toBe(429);
  });

  it('a resposta 429 segue o formato de erro da API', async () => {
    const aplicacao = await montar();
    let ultima = await chamar(aplicacao, { metodo: 'GET', url: '/api/saude' });
    for (let i = 0; i <= rota.regras.porEmail.max; i += 1) {
      ultima = await chamar(aplicacao, {
        metodo: 'POST',
        url: rota.url,
        corpo: rota.corpo('formato@exemplo.com.br'),
        ip: `10.3.3.${String(i + 1)}`,
      });
    }

    expect(ultima.json<{ erro: { codigo: string } }>().erro.codigo).toBe('muitas_requisicoes');
  });
});

describe('limite de troca de e-mail', () => {
  it('estourar o limite por e-mail de destino responde 429', async () => {
    const aplicacao = await montar();
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);
    const respostas: number[] = [];

    for (let i = 0; i <= LIMITES.trocaEmail.porEmail.max; i += 1) {
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail: 'destino@exemplo.com.br', senha: usuario.senha },
      });
      respostas.push(resposta.statusCode);
    }

    expect(respostas.at(-1)).toBe(429);
    expect(respostas.slice(0, -1).every((status) => status === 202)).toBe(true);
  });

  it('estourar o limite por IP responde 429', async () => {
    const aplicacao = await montar();
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);
    const respostas: number[] = [];

    for (let i = 0; i <= LIMITES.trocaEmail.porIp.max; i += 1) {
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/email',
        cookie,
        corpo: { novoEmail: `destino-${String(i)}@exemplo.com.br`, senha: usuario.senha },
        ip: '10.4.4.4',
      });
      respostas.push(resposta.statusCode);
    }

    expect(respostas.at(-1)).toBe(429);
  });
});

describe('limite de confirmação de senha', () => {
  it('conta as senhas erradas por usuário nas rotas que pedem a senha', async () => {
    const aplicacao = await montar();
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);
    const respostas: number[] = [];

    for (let i = 0; i <= LIMITES.confirmacaoDeSenha.max; i += 1) {
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/senha',
        cookie,
        corpo: { senhaAtual: 'senha-errada-123', novaSenha: 'nova-senha-segura-456' },
      });
      respostas.push(resposta.statusCode);
    }

    expect(respostas.slice(0, -1).every((status) => status === 403)).toBe(true);
    expect(respostas.at(-1)).toBe(429);
  });
});
