import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ErroNaoEncontrado } from '../../../src/shared/errors.js';
import { criarRegistradorCapturado } from '../../helpers/factories.js';
import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

const SEGREDO_NO_ERRO = 'detalhe-tecnico-secreto-do-banco';

function registrarRotasDeTeste(app: FastifyInstance): void {
  app.post('/teste/mudar-estado', () => ({ ok: true }));
  app.put('/teste/mudar-estado', () => ({ ok: true }));
  app.patch('/teste/mudar-estado', () => ({ ok: true }));
  app.delete('/teste/mudar-estado', () => ({ ok: true }));
  app.get('/teste/ler', () => ({ ok: true }));
  app.get('/teste/erro-de-dominio', () => {
    throw new ErroNaoEncontrado('Projeto não encontrado.', 'projeto_nao_encontrado');
  });
  app.get('/teste/erro-inesperado', () => {
    throw new Error(`falha: ${SEGREDO_NO_ERRO}`);
  });
}

function diretiva(csp: string, nome: string): string[] {
  const linha = csp
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${nome} `));
  return linha === undefined ? [] : linha.split(' ').slice(1);
}

describe('proteção CSRF', () => {
  let aplicacao: AppDeTeste;
  const origemValida = 'http://localhost:5173';

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({ rotasExtras: registrarRotasDeTeste });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  it('usa a origem de URL_APP configurada no exemplo de desenvolvimento', () => {
    expect(aplicacao.configuracao.origemApp).toBe(origemValida);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)(
    '%s sem Origin recebe 403',
    async (metodo) => {
      const resposta = await aplicacao.app.inject({ method: metodo, url: '/teste/mudar-estado' });

      expect(resposta.statusCode).toBe(403);
      expect(resposta.json<{ erro: { codigo: string } }>().erro.codigo).toBe('origem_invalida');
    },
  );

  it('POST com Origin de outro site recebe 403', async () => {
    const resposta = await aplicacao.app.inject({
      method: 'POST',
      url: '/teste/mudar-estado',
      headers: { origin: 'https://site-malicioso.exemplo' },
    });

    expect(resposta.statusCode).toBe(403);
  });

  it('POST com Origin de URL_APP passa', async () => {
    const resposta = await aplicacao.app.inject({
      method: 'POST',
      url: '/teste/mudar-estado',
      headers: { origin: origemValida },
    });

    expect(resposta.statusCode).toBe(200);
  });

  it('sem Origin, usa o Referer: o da origem certa passa, o de outra origem não', async () => {
    const certo = await aplicacao.app.inject({
      method: 'POST',
      url: '/teste/mudar-estado',
      headers: { referer: `${origemValida}/alguma/pagina?x=1` },
    });
    const errado = await aplicacao.app.inject({
      method: 'POST',
      url: '/teste/mudar-estado',
      headers: { referer: 'https://site-malicioso.exemplo/pagina' },
    });
    const invalido = await aplicacao.app.inject({
      method: 'POST',
      url: '/teste/mudar-estado',
      headers: { referer: 'isto não é uma url' },
    });

    expect(certo.statusCode).toBe(200);
    expect(errado.statusCode).toBe(403);
    expect(invalido.statusCode).toBe(403);
  });

  it('GET não exige Origin', async () => {
    const resposta = await aplicacao.app.inject({ method: 'GET', url: '/teste/ler' });

    expect(resposta.statusCode).toBe(200);
  });
});

describe('cabeçalhos de segurança', () => {
  it('em desenvolvimento traz os cabeçalhos do helmet, sem HSTS, e a CSP só libera as origens configuradas', async () => {
    const aplicacao = await montarAppDeTeste({ prepararBanco: false });
    try {
      const { headers } = await aplicacao.app.inject({
        method: 'GET',
        url: '/api/configuracao-publica',
      });

      const csp = String(headers['content-security-policy']);
      expect(diretiva(csp, 'font-src')).toEqual(["'self'", 'https://fonts.gstatic.com']);
      expect(diretiva(csp, 'style-src')).toEqual(["'self'", 'https://fonts.googleapis.com']);
      expect(diretiva(csp, 'default-src')).toEqual(["'self'"]);
      expect(diretiva(csp, 'frame-ancestors')).toEqual(["'none'"]);
      expect(diretiva(csp, 'object-src')).toEqual(["'none'"]);
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['referrer-policy']).toBeDefined();
      expect(headers['permissions-policy']).toBeDefined();
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['strict-transport-security']).toBeUndefined();
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('a CSP bloqueia fonte de domínio fora de ORIGENS_FONTE_EXTERNA', async () => {
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      configuracao: { origensFonteExterna: ['https://fontes.exemplo.com.br'] },
    });
    try {
      const { headers } = await aplicacao.app.inject({
        method: 'GET',
        url: '/api/configuracao-publica',
      });

      const fontes = diretiva(String(headers['content-security-policy']), 'font-src');
      expect(fontes).toEqual(["'self'", 'https://fontes.exemplo.com.br']);
      expect(fontes).not.toContain('https://fonts.gstatic.com');
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('em produção liga o HSTS', async () => {
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      configuracao: { estaEmProducao: true, ambiente: 'production' },
    });
    try {
      const { headers } = await aplicacao.app.inject({
        method: 'GET',
        url: '/api/configuracao-publica',
      });

      expect(String(headers['strict-transport-security'])).toContain('max-age=');
    } finally {
      await aplicacao.encerrar();
    }
  });
});

describe('manipulador de erros', () => {
  it('erro de domínio sai no formato da API, com idRequisicao', async () => {
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      rotasExtras: registrarRotasDeTeste,
    });
    try {
      const resposta = await aplicacao.app.inject({ method: 'GET', url: '/teste/erro-de-dominio' });

      expect(resposta.statusCode).toBe(404);
      expect(resposta.json()).toEqual({
        erro: {
          codigo: 'projeto_nao_encontrado',
          mensagem: 'Projeto não encontrado.',
          idRequisicao: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        },
      });
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('erro inesperado em produção sai genérico, sem detalhe nem stack', async () => {
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      configuracao: { estaEmProducao: true, ambiente: 'production' },
      rotasExtras: registrarRotasDeTeste,
    });
    try {
      const resposta = await aplicacao.app.inject({ method: 'GET', url: '/teste/erro-inesperado' });

      expect(resposta.statusCode).toBe(500);
      expect(resposta.json()).toEqual({
        erro: {
          codigo: 'erro_interno',
          mensagem: 'Erro interno do servidor.',
          idRequisicao: expect.any(String) as unknown,
        },
      });
      expect(resposta.body).not.toContain(SEGREDO_NO_ERRO);
      expect(resposta.body).not.toContain('stack');
      expect(resposta.body).not.toContain('.ts:');
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('em desenvolvimento o erro inesperado mostra a mensagem técnica, mas nunca a stack', async () => {
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      rotasExtras: registrarRotasDeTeste,
    });
    try {
      const resposta = await aplicacao.app.inject({ method: 'GET', url: '/teste/erro-inesperado' });

      expect(resposta.statusCode).toBe(500);
      expect(resposta.body).toContain(SEGREDO_NO_ERRO);
      expect(resposta.body).not.toContain('stack');
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('rota inexistente e corpo inválido também saem no formato da API', async () => {
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      rotasExtras: registrarRotasDeTeste,
    });
    try {
      const inexistente = await aplicacao.app.inject({ method: 'GET', url: '/api/nao-existe' });
      const jsonInvalido = await aplicacao.app.inject({
        method: 'POST',
        url: '/teste/mudar-estado',
        headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
        payload: '{quebrado',
      });

      expect(inexistente.statusCode).toBe(404);
      expect(inexistente.json<{ erro: { codigo: string } }>().erro.codigo).toBe('nao_encontrado');
      expect(jsonInvalido.statusCode).toBe(400);
      expect(jsonInvalido.json<{ erro: { codigo: string } }>().erro.codigo).toBe(
        'requisicao_invalida',
      );
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('o idRequisicao do erro é o mesmo que aparece nos logs', async () => {
    const { registrador, linhas } = criarRegistradorCapturado();
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      registrador,
      rotasExtras: registrarRotasDeTeste,
    });
    try {
      const resposta = await aplicacao.app.inject({ method: 'GET', url: '/teste/erro-inesperado' });

      const id = resposta.json<{ erro: { idRequisicao: string } }>().erro.idRequisicao;
      const doErro = linhas().filter((linha) => linha.idRequisicao === id);
      expect(doErro.length).toBeGreaterThanOrEqual(2);
      expect(doErro.some((linha) => linha.level === 50)).toBe(true);
    } finally {
      await aplicacao.encerrar();
    }
  });
});

describe('logs de requisição', () => {
  it('toda linha de requisição traz idRequisicao e nada sensível vaza', async () => {
    const { registrador, linhas, texto } = criarRegistradorCapturado();
    const aplicacao = await montarAppDeTeste({ prepararBanco: false, registrador });
    try {
      await aplicacao.app.inject({
        method: 'GET',
        url: '/api/configuracao-publica',
        headers: { authorization: 'Bearer token-secreto', cookie: 'sessao=cookie-secreto' },
      });

      const deRequisicao = linhas().filter((linha) => typeof linha.req === 'object');
      expect(deRequisicao.length).toBeGreaterThan(0);
      expect(deRequisicao.every((linha) => typeof linha.idRequisicao === 'string')).toBe(true);
      expect(texto()).not.toContain('token-secreto');
      expect(texto()).not.toContain('cookie-secreto');
    } finally {
      await aplicacao.encerrar();
    }
  });
});
