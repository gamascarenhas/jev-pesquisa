import { describe, expect, it } from 'vitest';

import {
  converterEstrelas,
  paraAvaliacao,
} from '../../../src/integrations/google/avaliacao-google.js';
import avaliacoesJson from '../../../src/integrations/google/fixtures/avaliacoes.json' with { type: 'json' };
import {
  gerarAvaliacoesDoGoogle,
  QUANTIDADE_DE_AVALIACOES,
} from '../../../scripts/fixtures-google.js';

describe('starRating', () => {
  it.each([
    ['ONE', 1],
    ['TWO', 2],
    ['THREE', 3],
    ['FOUR', 4],
    ['FIVE', 5],
  ])('%s vira %i', (estrelas, nota) => {
    expect(converterEstrelas(estrelas)).toBe(nota);
  });

  it('valor desconhecido ou ausente vira nulo', () => {
    expect(converterEstrelas('STAR_RATING_UNSPECIFIED')).toBeNull();
    expect(converterEstrelas(undefined)).toBeNull();
  });
});

describe('avaliação do Google', () => {
  const base = {
    reviewId: 'a',
    createTime: '2026-01-01T00:00:00Z',
    updateTime: '2026-01-01T00:00:00Z',
  };

  it('comentário vazio ou só com espaços vira nulo', () => {
    expect(paraAvaliacao({ ...base, starRating: 'FIVE', comment: '   ' }).comentario).toBeNull();
    expect(paraAvaliacao({ ...base, starRating: 'FIVE' }).comentario).toBeNull();
  });

  it('anônimo não tem autor', () => {
    const anonimo = { isAnonymous: true, displayName: 'Fulano' };

    expect(paraAvaliacao({ ...base, reviewer: anonimo }).autor).toBeNull();
    expect(paraAvaliacao({ ...base, reviewer: { displayName: 'Ana' } }).autor).toBe('Ana');
  });
});

describe('fixtures do Google', () => {
  const porUnidade = gerarAvaliacoesDoGoogle();
  const todas = Object.values(porUnidade).flat();

  it('são geradas por semente fixa e batem com o JSON versionado', () => {
    expect(porUnidade).toEqual(avaliacoesJson);
  });

  it('trazem cerca de 200 avaliações cobrindo notas, vazias, longas e mais de uma página', () => {
    expect(todas).toHaveLength(QUANTIDADE_DE_AVALIACOES);
    expect(new Set(todas.map((a) => a.starRating)).size).toBe(5);
    expect(todas.some((a) => a.comment === undefined)).toBe(true);
    expect(todas.some((a) => (a.comment?.length ?? 0) > 1000)).toBe(true);
    expect(Math.max(...Object.values(porUnidade).map((lista) => lista.length))).toBeGreaterThan(50);
    expect(new Set(todas.map((a) => a.reviewId)).size).toBe(todas.length);
  });
});
