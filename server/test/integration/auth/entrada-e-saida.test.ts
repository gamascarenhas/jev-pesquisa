import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarExigirAutenticacao } from '../../../src/http/guards/exigir-autenticacao.js';
import { exigirDono } from '../../../src/http/guards/exigir-dono.js';
import { exigirEmailConfirmado } from '../../../src/http/guards/exigir-email-confirmado.js';
import type { Aplicacao } from '../../../src/app.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';
import {
  criarContaComDonoDeTeste,
  criarContaDeTeste,
  criarEnviadorEmMemoria,
  criarProjetoDeTeste,
  criarRegistradorCapturado,
  criarUsuarioDeTeste,
  gerarUuid,
  type EnviadorEmMemoria,
} from '../../helpers/factories.js';
import { chamar, entrar } from '../../helpers/login.js';

function registrarRotasDeGuards(app: FastifyInstance, aplicacao: Aplicacao): void {
  const autenticar = criarExigirAutenticacao((contaId, usuarioId) =>
    aplicacao.servicos.autenticacao.carregarContexto(contaId, usuarioId),
  );
  app.get('/teste/ia', { preHandler: [autenticar, exigirEmailConfirmado] }, () => ({ ok: true }));
  app.get('/teste/dono', { preHandler: [autenticar, exigirDono] }, () => ({ ok: true }));
  app.get('/teste/sem-autenticar', { preHandler: [exigirDono] }, () => ({ ok: true }));
}

describe('entrada, saída e guards', () => {
  let aplicacao: AppDeTeste;
  let enviador: EnviadorEmMemoria;
  const captura = criarRegistradorCapturado();

  beforeAll(async () => {
    enviador = criarEnviadorEmMemoria();
    aplicacao = await montarAppDeTeste({
      enviadorDeEmail: enviador,
      registrador: captura.registrador,
      rotasExtras: registrarRotasDeGuards,
    });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  describe('guards', () => {
    it('exigir-autenticacao devolve 401 sem sessão', async () => {
      const resposta = await chamar(aplicacao, { metodo: 'GET', url: '/teste/ia' });

      expect(resposta.statusCode).toBe(401);
    });

    it('exigir-email-confirmado bloqueia usuário sem e-mail confirmado e libera o confirmado', async () => {
      const semConfirmar = await criarContaComDonoDeTeste(aplicacao.banco, {
        emailConfirmado: false,
      });
      const confirmado = await criarContaComDonoDeTeste(aplicacao.banco);

      const bloqueado = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/teste/ia',
        cookie: await entrar(aplicacao, semConfirmar.email),
      });
      const liberado = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/teste/ia',
        cookie: await entrar(aplicacao, confirmado.email),
      });

      expect(bloqueado.statusCode).toBe(403);
      expect(bloqueado.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'email_nao_confirmado',
      );
      expect(liberado.statusCode).toBe(200);
    });

    it('exigir-dono devolve 403 para member e 401 fora do fluxo de autenticação', async () => {
      const contaId = await criarContaDeTeste(aplicacao.banco);
      const dono = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'owner' });
      const membro = await criarUsuarioDeTeste(aplicacao.banco, contaId, { papel: 'member' });

      const comoDono = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/teste/dono',
        cookie: await entrar(aplicacao, dono.email),
      });
      const comoMembro = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/teste/dono',
        cookie: await entrar(aplicacao, membro.email),
      });
      const semAutenticar = await chamar(aplicacao, {
        metodo: 'GET',
        url: '/teste/sem-autenticar',
      });

      expect(comoDono.statusCode).toBe(200);
      expect(comoMembro.statusCode).toBe(403);
      expect(semAutenticar.statusCode).toBe(401);
    });

    it('a confirmação de e-mail muda o resultado do guard', async () => {
      const email = `guard-${gerarUuid()}@exemplo.com.br`;
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/cadastro',
        ip: '10.9.9.9',
        corpo: {
          nomeEmpresa: 'Empresa',
          nomeUsuario: 'Nome',
          email,
          senha: 'senha-longa-123',
          aceiteTermos: true,
        },
      });
      const cookie = await entrar(aplicacao, email, 'senha-longa-123');
      const antes = await chamar(aplicacao, { metodo: 'GET', url: '/teste/ia', cookie });
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/confirmar-email',
        corpo: { token: enviador.tokenDaUltimaMensagem(email) },
      });
      const depois = await chamar(aplicacao, { metodo: 'GET', url: '/teste/ia', cookie });

      expect(antes.statusCode).toBe(403);
      expect(depois.statusCode).toBe(200);
    });
  });

  describe('entrada', () => {
    const rotasPublicas: [string, Record<string, unknown>][] = [
      [
        '/api/auth/cadastro',
        {
          nomeEmpresa: 'E',
          nomeUsuario: 'N',
          email: 'a@exemplo.com.br',
          senha: 'senha-longa-123',
          aceiteTermos: true,
        },
      ],
      ['/api/auth/login', { email: 'a@exemplo.com.br', senha: 'senha-longa-123' }],
      ['/api/auth/confirmar-email', { token: 'abc' }],
      ['/api/auth/reenviar-confirmacao', { email: 'a@exemplo.com.br' }],
      ['/api/auth/esqueci-senha', { email: 'a@exemplo.com.br' }],
      ['/api/auth/redefinir-senha', { token: 'abc', novaSenha: 'senha-longa-123' }],
      [
        '/api/auth/aceitar-convite',
        { token: 'abc', nome: 'N', senha: 'senha-longa-123', aceiteTermos: true },
      ],
      ['/api/auth/confirmar-troca-email', { token: 'abc' }],
    ];

    it.each(rotasPublicas)('%s recusa chave desconhecida no corpo', async (url, corpo) => {
      const resposta = await chamar(aplicacao, {
        metodo: 'POST',
        url,
        corpo: { ...corpo, extra: 'nao-permitido' },
        ip: `10.8.${String(Math.floor(Math.random() * 250))}.${String(Math.floor(Math.random() * 250))}`,
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json<{ erro: { codigo: string } }>().erro.codigo).toBe('entrada_invalida');
    });

    it('rotas autenticadas recusam chave desconhecida no corpo', async () => {
      const dono = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, dono.email);
      const casos: [string, string, Record<string, unknown>][] = [
        ['POST', '/api/convites', { email: 'x@exemplo.com.br', extra: 1 }],
        ['POST', '/api/projetos', { nome: 'X', extra: 1 }],
        ['POST', '/api/perfil/senha', { senhaAtual: 'a', novaSenha: 'senha-longa-123', extra: 1 }],
        ['POST', '/api/perfil/email', { novoEmail: 'x@exemplo.com.br', senha: 'a', extra: 1 }],
        ['DELETE', '/api/conta', { senha: 'a', extra: 1 }],
      ];

      for (const [metodo, url, corpo] of casos) {
        const resposta = await chamar(aplicacao, {
          metodo: metodo as 'POST' | 'DELETE',
          url,
          cookie,
          corpo,
        });
        expect(resposta.statusCode, url).toBe(400);
      }
    });

    it('parâmetros de rota que não são UUID são recusados', async () => {
      const dono = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, dono.email);
      const casos: [string, string, Record<string, unknown> | undefined][] = [
        ['DELETE', '/api/usuarios/nao-e-uuid', undefined],
        ['DELETE', '/api/convites/nao-e-uuid', undefined],
        ['PATCH', '/api/projetos/nao-e-uuid', { nome: 'X' }],
        ['DELETE', '/api/projetos/nao-e-uuid', { nomeProjeto: 'X' }],
      ];

      for (const [metodo, url, corpo] of casos) {
        const resposta = await chamar(aplicacao, {
          metodo: metodo as 'DELETE' | 'PATCH',
          url,
          cookie,
          ...(corpo === undefined ? {} : { corpo }),
        });
        expect(resposta.statusCode, url).toBe(400);
      }
    });
  });

  describe('saída', () => {
    it('nenhuma resposta traz hash de senha, token ou valores em dólar', async () => {
      const dono = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, dono.email);
      const email = `saida-${dono.id}@exemplo.com.br`;
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/convites',
        cookie,
        corpo: { email },
      });
      await criarProjetoDeTeste(aplicacao.banco, dono.contaId);
      const token = enviador.tokenDaUltimaMensagem(email);
      const urls = [
        '/api/auth/eu',
        '/api/usuarios',
        '/api/convites',
        '/api/conta',
        '/api/planos',
        '/api/projetos',
      ];

      const corpos = await Promise.all(
        urls.map(async (url) => (await chamar(aplicacao, { metodo: 'GET', url, cookie })).body),
      );
      const login = await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/auth/login',
        corpo: { email: dono.email, senha: dono.senha },
      });
      const todos = [...corpos, login.body, String(login.headers['set-cookie'])].join('\n');

      expect(todos).not.toMatch(/hash_senha|hashSenha|argon2|hash_token|hashToken/i);
      expect(todos).not.toContain(token);
      expect(todos).not.toMatch(/limite_custo|limiteCusto|usd/i);
      expect(todos).not.toContain(dono.senha);
    });

    it('a listagem de planos devolve só id, nome e preço', async () => {
      const dono = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, dono.email);

      const resposta = await chamar(aplicacao, { metodo: 'GET', url: '/api/planos', cookie });

      const { itens } = resposta.json<{ itens: Record<string, unknown>[] }>();
      expect(itens.map((plano) => plano.id)).toEqual(['trial', 'basic', 'pro']);
      expect(Object.keys(itens[0] ?? {}).sort()).toEqual(['id', 'nome', 'precoMensalCentavos']);
    });

    it('as rotas autenticadas respondem 401 sem sessão', async () => {
      const casos: [string, string][] = [
        ['GET', '/api/auth/eu'],
        ['GET', '/api/usuarios'],
        ['GET', '/api/convites'],
        ['GET', '/api/conta'],
        ['GET', '/api/planos'],
        ['GET', '/api/projetos'],
      ];

      for (const [metodo, url] of casos) {
        const resposta = await chamar(aplicacao, { metodo: metodo as 'GET', url });
        expect(resposta.statusCode, url).toBe(401);
      }
    });
  });

  describe('auditoria', () => {
    it('troca de senha gera log de auditoria sem e-mail, senha nem token', async () => {
      const dono = await criarContaComDonoDeTeste(aplicacao.banco);
      const cookie = await entrar(aplicacao, dono.email);
      await chamar(aplicacao, {
        metodo: 'POST',
        url: '/api/perfil/senha',
        cookie,
        corpo: { senhaAtual: dono.senha, novaSenha: 'nova-senha-segura-456' },
      });

      const evento = captura
        .linhas()
        .find((linha) => linha.acao === 'senha_trocada' && linha.usuarioId === dono.id);

      expect(evento).toMatchObject({ categoria: 'auditoria', contaId: dono.contaId });
      const texto = JSON.stringify(evento);
      expect(texto).not.toContain(dono.email);
      expect(texto).not.toContain('nova-senha-segura-456');
    });

    it('nenhum log da suíte contém senha, hash ou o texto dos cookies', () => {
      const texto = captura.texto();

      expect(texto).not.toContain('senha-de-teste-123');
      expect(texto).not.toContain('nova-senha-segura-456');
      expect(texto).not.toMatch(/\$argon2/);
    });
  });
});
