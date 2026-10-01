import { describe, expect, it } from 'vitest';

import type { RespostasDoComentario } from '../../../src/integrations/jev/classificador-comentarios.js';
import {
  MAX_CARACTERES_COMENTARIO,
  NIVEL_MAXIMO_DE_GRAVIDADE,
  montarEstado,
  normalizarGravidade,
  posProcessar,
  precisaDeRevisao,
} from '../../../src/modules/classification/pos-processamento.js';
import { comoComentarioId } from '../../../src/shared/ids.js';
import { LIMIAR_PRECISA_ACAO, precisaDeAcao } from '../../../src/shared/thresholds.js';

function comentario(texto: string, nota: number | null = null, unidade: string | null = null) {
  return { id: comoComentarioId('c-1'), textoMascarado: texto, nota, unidade };
}

function resultado(sobrescritas: {
  temaConfianca?: number;
  sentimentoConfianca?: number;
  gravidade?: number;
  acao?: number;
}): RespostasDoComentario {
  return {
    modelo: 'jev-teste',
    uso: { tokensEntrada: 100, tokensSaida: 10 },
    tentativasAmbiguas: 0,
    respostas: {
      topic: {
        type: 'choice',
        choice: 'price',
        confidence: sobrescritas.temaConfianca ?? 0.9,
        probabilities: { price: 0.9, other: 0.1 },
      },
      sentiment: {
        type: 'choice',
        choice: 'negative',
        confidence: sobrescritas.sentimentoConfianca ?? 0.9,
        probabilities: { negative: 0.9, positive: 0.1 },
      },
      severity: {
        type: 'score',
        score: sobrescritas.gravidade ?? 2,
        confidence: 0.8,
        legend: { 0: 'a', 1: 'b', 2: 'c', 3: 'd' },
        probabilities: { 0: 0.1, 1: 0.1, 2: 0.7, 3: 0.1 },
      },
      needs_action: { type: 'noul', noul: sobrescritas.acao ?? 0.8 },
    },
  } as unknown as RespostasDoComentario;
}

describe('precisa de revisão', () => {
  it.each([
    [0.49, 0.9, true],
    [0.5, 0.9, false],
    [0.9, 0.49, true],
    [0.9, 0.5, false],
    [0.1, 0.1, true],
    [1, 1, false],
  ])('tema %s e sentimento %s → %s', (tema, sentimento, esperado) => {
    expect(precisaDeRevisao(tema, sentimento)).toBe(esperado);
  });
});

describe('gravidade normalizada', () => {
  it('divide pelo índice do nível mais alto, hoje 3, e limita entre 0 e 1', () => {
    expect(NIVEL_MAXIMO_DE_GRAVIDADE).toBe(3);
    expect(normalizarGravidade(0)).toBe(0);
    expect(normalizarGravidade(1.5)).toBe(0.5);
    expect(normalizarGravidade(3)).toBe(1);
    expect(normalizarGravidade(4)).toBe(1);
    expect(normalizarGravidade(-1)).toBe(0);
  });
});

describe('precisa de ação', () => {
  it('a fronteira é 0,5: 0,49 não precisa e 0,5 precisa', () => {
    expect(LIMIAR_PRECISA_ACAO).toBe(0.5);
    expect(precisaDeAcao(0.49)).toBe(false);
    expect(precisaDeAcao(0.5)).toBe(true);
    expect(precisaDeAcao(0.51)).toBe(true);
    expect(precisaDeAcao(0)).toBe(false);
  });
});

describe('montarEstado', () => {
  it('monta o state com nomes descritivos a partir do texto mascarado', () => {
    expect(montarEstado(comentario('Ótimo [EMAIL]', 4, 'Centro'))).toEqual({
      estado: { comment: 'Ótimo [EMAIL]', rating: 4, location: 'Centro' },
      truncado: false,
    });
    expect(montarEstado(comentario('x')).estado).toEqual({
      comment: 'x',
      rating: null,
      location: null,
    });
  });

  it('trunca em 4.000 caracteres e avisa que truncou', () => {
    const exato = montarEstado(comentario('a'.repeat(MAX_CARACTERES_COMENTARIO)));
    const maior = montarEstado(comentario('a'.repeat(MAX_CARACTERES_COMENTARIO + 1)));

    expect(MAX_CARACTERES_COMENTARIO).toBe(4_000);
    expect(exato.truncado).toBe(false);
    expect(maior.truncado).toBe(true);
    expect(maior.estado.comment).toHaveLength(4_000);
  });
});

describe('posProcessar', () => {
  it('converte a resposta do Jev para a classificação gravada', () => {
    const pronta = posProcessar(resultado({ gravidade: 2, acao: 0.8 }));

    expect(pronta).toMatchObject({
      modelo: 'jev-teste',
      tema: 'price',
      temaConfianca: 0.9,
      sentimento: 'negative',
      gravidadePontuacao: 2,
      precisaAcao: 0.8,
      precisaRevisao: false,
    });
    expect(pronta.gravidadeNormalizada).toBeCloseTo(2 / 3, 10);
    expect(pronta.temaProbabilidades).toEqual({ price: 0.9, other: 0.1 });
  });

  it('marca para revisão quando a confiança do tema ou do sentimento é baixa', () => {
    expect(posProcessar(resultado({ temaConfianca: 0.3 })).precisaRevisao).toBe(true);
    expect(posProcessar(resultado({ sentimentoConfianca: 0.3 })).precisaRevisao).toBe(true);
  });
});
