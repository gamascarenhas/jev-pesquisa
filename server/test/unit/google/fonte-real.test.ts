import { afterEach, describe, expect, it, vi } from 'vitest';

import { criarFonteDeAvaliacoesGoogle } from '../../../src/integrations/google/fonte-avaliacoes-google.js';
import { ErroDoGoogle } from '../../../src/integrations/google/fonte-avaliacoes.js';

const fonte = criarFonteDeAvaliacoesGoogle({
  idCliente: 'id-cliente',
  segredoCliente: 'segredo-cliente',
  uriRedirecionamento: 'https://app.exemplo.com.br/api/google/callback',
});

interface RespostaFalsa {
  status: number;
  corpo?: unknown;
}

function simularFetch(...respostas: RespostaFalsa[]) {
  const chamadas: { url: string; init: RequestInit | undefined }[] = [];
  const fila = [...respostas];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      chamadas.push({ url, init });
      const resposta = fila.shift() ?? { status: 500 };
      const corpo = JSON.stringify(resposta.corpo ?? {});
      return Promise.resolve(new Response(corpo, { status: resposta.status }));
    }),
  );
  return chamadas;
}

function corpoDe(init: RequestInit | undefined): string {
  return typeof init?.body === 'string' ? init.body : '';
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('integração real com o Google', () => {
  it('a URL de autorização pede acesso offline, o escopo business.manage e leva o state', () => {
    const url = new URL(fonte.urlDeAutorizacao('estado-123'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('estado-123');
    expect(url.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/business.manage',
    );
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://app.exemplo.com.br/api/google/callback',
    );
  });

  it('lê as avaliações pela API v4 com pageSize 50, updateTime desc e o token no cabeçalho', async () => {
    const chamadas = simularFetch({
      status: 200,
      corpo: {
        reviews: [
          {
            reviewId: 'r1',
            starRating: 'FOUR',
            comment: 'Bom',
            createTime: '2026-01-01T00:00:00Z',
            updateTime: '2026-01-02T00:00:00Z',
          },
        ],
        nextPageToken: 'proxima',
      },
    });

    const pagina = await fonte.listarAvaliacoes('token-de-acesso', 'accounts/1/locations/2', 'abc');

    const url = new URL(chamadas[0]?.url ?? '');
    expect(url.origin + url.pathname).toBe(
      'https://mybusiness.googleapis.com/v4/accounts/1/locations/2/reviews',
    );
    expect(url.searchParams.get('pageSize')).toBe('50');
    expect(url.searchParams.get('orderBy')).toBe('updateTime desc');
    expect(url.searchParams.get('pageToken')).toBe('abc');
    expect(chamadas[0]?.init?.headers).toMatchObject({ authorization: 'Bearer token-de-acesso' });
    expect(chamadas[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(pagina.proximaPagina).toBe('proxima');
    expect(pagina.avaliacoes[0]).toMatchObject({ id: 'r1', nota: 4, comentario: 'Bom' });
  });

  it('monta o nome da unidade da v4 a partir da conta e do locations/{id} da API v1', async () => {
    const chamadas = simularFetch({
      status: 200,
      corpo: {
        locations: [
          {
            name: 'locations/777',
            title: 'Loja Centro',
            storefrontAddress: { addressLines: ['Rua A, 1'], locality: 'São Paulo' },
          },
        ],
      },
    });

    const unidades = await fonte.listarUnidades('t', 'accounts/123');

    const url = new URL(chamadas[0]?.url ?? '');
    expect(url.pathname).toBe('/v1/accounts/123/locations');
    expect(url.searchParams.get('readMask')).toBe('name,title,storefrontAddress');
    expect(unidades).toEqual([
      {
        nome: 'accounts/123/locations/777',
        titulo: 'Loja Centro',
        endereco: 'Rua A, 1, São Paulo',
      },
    ]);
  });

  it.each([
    [401, 'nao_autorizado'],
    [403, 'sem_acesso'],
    [429, 'limite'],
    [503, 'indisponivel'],
  ])('o status %i vira o erro %s', async (status, tipo) => {
    simularFetch({ status });

    await expect(fonte.listarAvaliacoes('t', 'accounts/1/locations/2', null)).rejects.toMatchObject(
      { name: 'ErroDoGoogle', tipo },
    );
  });

  it('falha de rede vira indisponível, sem vazar a mensagem original', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNRESET segredo'))),
    );

    const erro = await fonte.listarContas('t').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDoGoogle);
    expect((erro as Error).message).not.toContain('segredo');
  });

  it('troca o código por tokens e lê o e-mail do id_token; renovar usa refresh_token', async () => {
    const carga = Buffer.from(JSON.stringify({ email: 'dono@exemplo.com.br' })).toString(
      'base64url',
    );
    const chamadas = simularFetch(
      {
        status: 200,
        corpo: {
          access_token: 'a',
          refresh_token: 'r',
          expires_in: 3600,
          scope: 'openid email',
          id_token: `x.${carga}.y`,
        },
      },
      { status: 200, corpo: { access_token: 'a2', expires_in: 3600, scope: 'openid' } },
      { status: 400, corpo: { error: 'invalid_grant' } },
    );

    const conexao = await fonte.trocarCodigo('codigo');
    const renovado = await fonte.renovarToken('r');
    const revogada = await fonte.renovarToken('r').catch((e: unknown) => e);

    expect(conexao).toMatchObject({
      tokenAcesso: 'a',
      tokenAtualizacao: 'r',
      email: 'dono@exemplo.com.br',
    });
    expect(renovado.tokenAcesso).toBe('a2');
    expect(corpoDe(chamadas[0]?.init)).toContain('grant_type=authorization_code');
    expect(corpoDe(chamadas[1]?.init)).toContain('grant_type=refresh_token');
    expect(revogada).toMatchObject({ tipo: 'concessao_invalida' });
  });
});
