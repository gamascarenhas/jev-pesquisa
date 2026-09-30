import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DURACAO_BLOQUEIO_LOGIN_MS,
  LIMITE_TENTATIVAS_LOGIN,
} from '../../../src/modules/auth/autenticacao.servico.js';
import {
  VALIDADE_SESSAO_ABSOLUTA_MS,
  VALIDADE_SESSAO_OCIOSA_MS,
} from '../../../src/http/plugins/sessao.plugin.js';
import type { Relogio } from '../../../src/shared/clock.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarContaComDonoDeTeste,
  criarRegistradorCapturado,
  SENHA_DE_TESTE,
  type UsuarioDeTeste,
} from '../../helpers/factories.js';
import { chamar, cookieDaResposta, entrar } from '../../helpers/login.js';

const INICIO = new Date('2026-05-01T09:00:00.000Z');
const UM_DIA_MS = 24 * 60 * 60 * 1000;

interface Erro {
  erro: { codigo: string; mensagem: string };
}

describe('login, bloqueio e sessão', () => {
  let aplicacao: AppDeTeste;
  let agora: Date;
  const relogio: Relogio = { agora: () => new Date(agora) };

  beforeAll(async () => {
    agora = new Date(INICIO);
    aplicacao = await montarAppDeTeste({ relogio });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  function tentarLogin(email: string, senha: string) {
    return chamar(aplicacao, { metodo: 'POST', url: '/api/auth/login', corpo: { email, senha } });
  }

  function consultarEu(cookie: string) {
    return chamar(aplicacao, { metodo: 'GET', url: '/api/auth/eu', cookie });
  }

  it('login correto devolve o usuário e um cookie httpOnly com sameSite lax', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);

    const resposta = await tentarLogin(usuario.email, usuario.senha);

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ email: usuario.email, papel: 'owner' });
    const cabecalho = String(resposta.headers['set-cookie']);
    expect(cabecalho).toMatch(/^sessao=/);
    expect(cabecalho).toContain('HttpOnly');
    expect(cabecalho).toContain('SameSite=Lax');
    expect(cabecalho).not.toContain('Secure');
  });

  it('e-mail inexistente e senha errada respondem exatamente igual', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);

    const inexistente = await tentarLogin('ninguem@exemplo.com.br', 'qualquer-senha-123');
    const senhaErrada = await tentarLogin(usuario.email, 'senha-errada-123');

    expect(inexistente.statusCode).toBe(401);
    expect(senhaErrada.statusCode).toBe(401);
    const semId = (corpo: Erro) => ({ ...corpo.erro, idRequisicao: undefined });
    expect(semId(senhaErrada.json<Erro>())).toEqual(semId(inexistente.json<Erro>()));
    expect(inexistente.json<Erro>().erro.mensagem).toBe('E-mail ou senha incorretos.');
  });

  it(`bloqueia após ${String(LIMITE_TENTATIVAS_LOGIN)} tentativas erradas, com a mesma resposta, e libera depois`, async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    for (let tentativa = 0; tentativa < LIMITE_TENTATIVAS_LOGIN; tentativa += 1) {
      await tentarLogin(usuario.email, 'senha-errada-123');
    }

    const durante = await tentarLogin(usuario.email, usuario.senha);

    expect(durante.statusCode).toBe(401);
    expect(durante.json<Erro>().erro.mensagem).toBe('E-mail ou senha incorretos.');
    agora = new Date(agora.getTime() + DURACAO_BLOQUEIO_LOGIN_MS + 1000);
    const depois = await tentarLogin(usuario.email, usuario.senha);
    expect(depois.statusCode).toBe(200);
  });

  it('quatro erros seguidos de um acerto não bloqueiam', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    for (let tentativa = 0; tentativa < LIMITE_TENTATIVAS_LOGIN - 1; tentativa += 1) {
      await tentarLogin(usuario.email, 'senha-errada-123');
    }
    await tentarLogin(usuario.email, usuario.senha);
    await tentarLogin(usuario.email, 'senha-errada-123');

    const resposta = await tentarLogin(usuario.email, usuario.senha);

    expect(resposta.statusCode).toBe(200);
  });

  it('logout encerra a sessão', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);

    const saida = await chamar(aplicacao, { metodo: 'POST', url: '/api/auth/logout', cookie });
    const depois = await consultarEu(cookie);

    expect(saida.statusCode).toBe(204);
    expect(depois.statusCode).toBe(401);
  });

  it('a sessão expira após 7 dias sem uso', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);

    agora = new Date(agora.getTime() + VALIDADE_SESSAO_OCIOSA_MS - 1000);
    const antes = await consultarEu(cookie);
    agora = new Date(agora.getTime() + VALIDADE_SESSAO_OCIOSA_MS + 1000);
    const depois = await consultarEu(cookie);

    expect(antes.statusCode).toBe(200);
    expect(depois.statusCode).toBe(401);
  });

  it('cada uso renova a sessão, mas ela morre aos 30 dias absolutos', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);
    const inicio = agora.getTime();

    for (const dias of [6, 12, 18, 24]) {
      agora = new Date(inicio + dias * UM_DIA_MS);
      expect((await consultarEu(cookie)).statusCode).toBe(200);
    }
    agora = new Date(inicio + VALIDADE_SESSAO_ABSOLUTA_MS + 1000);
    const alemDoLimite = await consultarEu(cookie);

    expect(alemDoLimite.statusCode).toBe(401);
    const restantes = await aplicacao.banco.query('SELECT 1 FROM sessoes WHERE usuario_id = $1', [
      usuario.id,
    ]);
    expect(restantes.rowCount).toBe(0);
  });

  it('a sessão sobrevive a um reinício do servidor', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);

    const reiniciada = await montarAppDeTeste({ relogio, prepararBanco: false });
    const resposta = await chamar(reiniciada, { metodo: 'GET', url: '/api/auth/eu', cookie });
    await reiniciada.encerrar();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({ email: usuario.email });
  });

  it('cookie adulterado não autentica', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const cookie = await entrar(aplicacao, usuario.email);

    const resposta = await consultarEu(`${cookie}x`);

    expect(resposta.statusCode).toBe(401);
  });

  it('o login grava as datas do último acesso e o login de outra sessão não derruba esta', async () => {
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);
    const primeira = await entrar(aplicacao, usuario.email);
    await entrar(aplicacao, usuario.email);

    expect((await consultarEu(primeira)).statusCode).toBe(200);
    const linha = await aplicacao.banco.query<{ ultimo_login_em: Date }>(
      'SELECT ultimo_login_em FROM usuarios WHERE id = $1',
      [usuario.id],
    );
    expect(linha.rows[0]?.ultimo_login_em).toEqual(agora);
  });
});

describe('sessão em produção', () => {
  it('usa o prefixo __Host- com Secure, Path=/ e sem Domain', async () => {
    const aplicacao = await montarAppDeTeste({
      configuracao: { estaEmProducao: true, confiarProxy: true },
    });
    const usuario: UsuarioDeTeste = await criarContaComDonoDeTeste(aplicacao.banco);

    const resposta = await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/login',
      corpo: { email: usuario.email, senha: SENHA_DE_TESTE },
      cabecalhos: { 'x-forwarded-proto': 'https' },
    });
    const cabecalho = String(resposta.headers['set-cookie']);
    const cookie = cookieDaResposta(resposta);
    const seguinte = await chamar(aplicacao, {
      metodo: 'GET',
      url: '/api/auth/eu',
      cookie,
      cabecalhos: { 'x-forwarded-proto': 'https' },
    });
    await aplicacao.encerrar();

    expect(cabecalho).toMatch(/^__Host-sessao=/);
    expect(cabecalho).toContain('Secure');
    expect(cabecalho).toContain('Path=/');
    expect(cabecalho).not.toContain('Domain');
    expect(seguinte.statusCode).toBe(200);
  });
});

describe('auditoria do login', () => {
  it('registra sucesso e falha só com ids, sem e-mail nem senha', async () => {
    const captura = criarRegistradorCapturado();
    const aplicacao = await montarAppDeTeste({ registrador: captura.registrador });
    const usuario = await criarContaComDonoDeTeste(aplicacao.banco);

    await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/login',
      corpo: { email: usuario.email, senha: 'senha-errada-123' },
    });
    await chamar(aplicacao, {
      metodo: 'POST',
      url: '/api/auth/login',
      corpo: { email: usuario.email, senha: usuario.senha },
    });
    await aplicacao.encerrar();

    const auditoria = captura.linhas().filter((linha) => linha.categoria === 'auditoria');
    expect(auditoria.map((linha) => linha.acao)).toEqual(['login_falha', 'login_sucesso']);
    expect(auditoria[1]).toMatchObject({ usuarioId: usuario.id, contaId: usuario.contaId });
    const texto = JSON.stringify(auditoria);
    expect(texto).not.toContain(usuario.email);
    expect(texto).not.toContain('senha-errada-123');
    expect(texto).not.toContain(usuario.senha);
  });
});
