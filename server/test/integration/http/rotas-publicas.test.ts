import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { montarAppDeTeste, type AppDeTeste } from '../../helpers/build-app.js';

describe('GET /api/configuracao-publica', () => {
  let aplicacao: AppDeTeste;

  beforeAll(async () => {
    aplicacao = await montarAppDeTeste({ prepararBanco: false });
  });
  afterAll(async () => {
    await aplicacao.encerrar();
  });

  it('devolve só { nomeNegocio }', async () => {
    const resposta = await aplicacao.app.inject({
      method: 'GET',
      url: '/api/configuracao-publica',
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ nomeNegocio: 'Escuta' });
  });

  it('não vaza nenhum segredo nem URL de banco', async () => {
    const resposta = await aplicacao.app.inject({
      method: 'GET',
      url: '/api/configuracao-publica',
    });

    expect(resposta.body).not.toContain(aplicacao.configuracao.segredoSessao);
    expect(resposta.body).not.toContain('postgres://');
  });
});

describe('GET /api/saude', () => {
  it('responde 200 com { status: "ok" } quando o banco está no ar', async () => {
    const aplicacao = await montarAppDeTeste();
    try {
      const resposta = await aplicacao.app.inject({ method: 'GET', url: '/api/saude' });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ status: 'ok' });
    } finally {
      await aplicacao.encerrar();
    }
  });

  it('responde 503 sem o banco, sem expor detalhes', async () => {
    // Porta 1: conexão recusada na hora.
    const aplicacao = await montarAppDeTeste({
      prepararBanco: false,
      configuracao: { urlBanco: 'postgres://usuario:senha-do-banco@127.0.0.1:1/inexistente' },
    });
    try {
      const resposta = await aplicacao.app.inject({ method: 'GET', url: '/api/saude' });

      expect(resposta.statusCode).toBe(503);
      expect(resposta.json()).toEqual({
        erro: {
          codigo: 'banco_indisponivel',
          mensagem: 'Serviço indisponível.',
          idRequisicao: expect.any(String) as unknown,
        },
      });
      for (const detalhe of ['ECONNREFUSED', '127.0.0.1', 'senha-do-banco', 'postgres']) {
        expect(resposta.body).not.toContain(detalhe);
      }
    } finally {
      await aplicacao.encerrar();
    }
  });
});
