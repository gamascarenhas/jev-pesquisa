import { describe, expect, it } from 'vitest';

import { criarClassificadorJev } from '../../../src/integrations/jev/classificador-jev.js';
import {
  ErroDeIaAmbiguo,
  ErroDeIaNaoCobrado,
} from '../../../src/modules/usage/controle-custo.servico.js';

const ESTADO = { comment: 'TEXTO-SECRETO-DO-COMENTARIO', rating: 3, location: 'Centro' };

const RESPOSTA_VALIDA = {
  model: 'jev-1.13.0',
  answers: {
    topic: {
      type: 'choice',
      choice: 'price',
      confidence: 0.9,
      probabilities: { price: 0.9, other: 0.1 },
    },
    sentiment: {
      type: 'choice',
      choice: 'negative',
      confidence: 0.8,
      probabilities: { negative: 0.8, positive: 0.2 },
    },
    severity: {
      type: 'score',
      score: 1,
      confidence: 0.7,
      legend: { 0: 'a', 1: 'b' },
      probabilities: { 0: 0.3, 1: 0.7 },
    },
    needs_action: { type: 'noul', noul: 0.6 },
  },
  usage: { input_tokens: 321, output_tokens: 12 },
};

type Passo = { status: number; corpo?: unknown } | 'queda' | 'travado';

interface RequisicaoCapturada {
  url: string;
  autorizacao: string | null;
  corpo: { state: unknown; model: string; questions: Record<string, unknown> };
}

function criarFetchFalso(passos: Passo[]) {
  const requisicoes: RequisicaoCapturada[] = [];
  const falso = (url: string, init?: RequestInit): Promise<Response> => {
    const cabecalhos = new Headers(init?.headers);
    requisicoes.push({
      url,
      autorizacao: cabecalhos.get('authorization'),
      corpo: JSON.parse(init?.body as string) as RequisicaoCapturada['corpo'],
    });
    const passo = passos[Math.min(requisicoes.length, passos.length) - 1];
    if (passo === 'queda') {
      return Promise.reject(new TypeError('fetch failed'));
    }
    if (passo === 'travado' || passo === undefined) {
      return new Promise((_resolver, rejeitar) => {
        init?.signal?.addEventListener('abort', () => {
          rejeitar(new DOMException('abortado', 'AbortError'));
        });
      });
    }
    return Promise.resolve(
      new Response(JSON.stringify(passo.corpo ?? { error: 'x' }), {
        status: passo.status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { fetch: falso, requisicoes };
}

function criar(passos: Passo[], extras: { tempoLimiteMs?: number } = {}) {
  const falso = criarFetchFalso(passos);
  const jev = criarClassificadorJev({
    chaveApi: 'chave-de-teste',
    modelo: 'jev-1.13.0',
    fetch: falso.fetch,
    repeticao: { backoffInitialMs: 1, backoffMaxMs: 2, backoffJitter: 0 },
    ...extras,
  });
  return { jev, requisicoes: falso.requisicoes };
}

describe('Jev real: uma requisição por comentário', () => {
  it('envia state, model e todas as perguntas padrão numa única requisição autenticada', async () => {
    const { jev, requisicoes } = criar([{ status: 200, corpo: RESPOSTA_VALIDA }]);

    const resultado = await jev.classificarComentario(ESTADO);

    expect(requisicoes).toHaveLength(1);
    const [requisicao] = requisicoes;
    expect(requisicao?.url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(requisicao?.autorizacao).toBe('Bearer chave-de-teste');
    expect(requisicao?.corpo.model).toBe('jev-1.13.0');
    expect(requisicao?.corpo.state).toEqual(ESTADO);
    expect(Object.keys(requisicao?.corpo.questions ?? {})).toEqual([
      'topic',
      'sentiment',
      'severity',
      'needs_action',
    ]);
    expect(resultado.modelo).toBe('jev-1.13.0');
    expect(resultado.uso).toEqual({ tokensEntrada: 321, tokensSaida: 12 });
    expect(resultado.tentativasAmbiguas).toBe(0);
    expect(resultado.respostas.topic.choice).toBe('price');
  });

  it('o método genérico serve a qualquer conjunto de perguntas', async () => {
    const { jev, requisicoes } = criar([
      { status: 200, corpo: { ...RESPOSTA_VALIDA, answers: { x: { type: 'noul', noul: 0.2 } } } },
    ]);

    const resultado = await jev.avaliar(
      { claim: 'a' },
      { x: { type: 'noul', instructions: 'Is it?' } },
    );

    expect(requisicoes[0]?.corpo.questions).toEqual({
      x: { type: 'noul', instructions: 'Is it?' },
    });
    expect(resultado.respostas.x.noul).toBe(0.2);
  });
});

describe('Jev real: repetições do SDK', () => {
  it('repete no máximo 2 vezes: erro 500 contínuo gera exatamente 3 requisições', async () => {
    const { jev, requisicoes } = criar([{ status: 500 }]);

    const erro = await jev.classificarComentario(ESTADO).catch((e: unknown) => e);

    expect(requisicoes).toHaveLength(3);
    expect(erro).toBeInstanceOf(ErroDeIaAmbiguo);
    expect((erro as ErroDeIaAmbiguo).tentativas).toBe(3);
  });

  it('uma falha 500 seguida de sucesso soma uma tentativa ambígua à cobrança', async () => {
    const { jev, requisicoes } = criar([{ status: 500 }, { status: 200, corpo: RESPOSTA_VALIDA }]);

    const resultado = await jev.classificarComentario(ESTADO);

    expect(requisicoes).toHaveLength(2);
    expect(resultado.tentativasAmbiguas).toBe(1);
  });

  it('queda de conexão e depois sucesso também conta como tentativa ambígua', async () => {
    const { jev } = criar(['queda', 'queda', { status: 200, corpo: RESPOSTA_VALIDA }]);

    const resultado = await jev.classificarComentario(ESTADO);

    expect(resultado.tentativasAmbiguas).toBe(2);
  });
});

describe('Jev real: classificação das falhas para o controle de custo', () => {
  it.each([401, 422, 400])('erro %s é inequívoco e não repete', async (status) => {
    const { jev, requisicoes } = criar([{ status }]);

    const erro = await jev.classificarComentario(ESTADO).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDeIaNaoCobrado);
    expect(requisicoes).toHaveLength(status === 401 || status === 422 || status === 400 ? 1 : 3);
  });

  it('429 contínuo repete até o limite e não foi cobrado', async () => {
    const { jev, requisicoes } = criar([{ status: 429 }]);

    const erro = await jev.classificarComentario(ESTADO).catch((e: unknown) => e);

    expect(requisicoes).toHaveLength(3);
    expect(erro).toBeInstanceOf(ErroDeIaNaoCobrado);
  });

  it('timeout depois do envio é ambíguo e tem limite de tempo por tentativa', async () => {
    const { jev, requisicoes } = criar(['travado'], { tempoLimiteMs: 20 });

    const erro = await jev.classificarComentario(ESTADO).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroDeIaAmbiguo);
    expect(requisicoes.length).toBeGreaterThanOrEqual(1);
    expect(requisicoes.length).toBeLessThanOrEqual(3);
  });

  it('cancelar pela assinatura é ambíguo e não repete', async () => {
    const { jev, requisicoes } = criar(['travado']);
    const controle = new AbortController();

    const execucao = jev.classificarComentario(ESTADO, { sinal: controle.signal });
    setTimeout(() => {
      controle.abort();
    }, 10);

    await expect(execucao).rejects.toBeInstanceOf(ErroDeIaAmbiguo);
    expect(requisicoes).toHaveLength(1);
  });

  it('a mensagem do erro nunca carrega o texto do comentário', async () => {
    const { jev } = criar([{ status: 422, corpo: { detail: ESTADO.comment } }]);

    const erro = (await jev.classificarComentario(ESTADO).catch((e: unknown) => e)) as Error;

    expect(erro.message).not.toContain('TEXTO-SECRETO');
    expect(erro.message).toContain('422');
  });
});
