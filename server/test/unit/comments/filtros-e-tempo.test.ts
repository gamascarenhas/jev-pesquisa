import { describe, expect, it } from 'vitest';

import {
  estimarMinutos,
  vazaoEfetivaPorMinuto,
} from '../../../src/modules/classification/estimativa-de-tempo.js';
import {
  converterFiltros,
  traduzirFiltros,
} from '../../../src/modules/comments/filtros-comentarios.js';
import { LIMIAR_PRECISA_ACAO } from '../../../src/shared/thresholds.js';

describe('traduzirFiltros', () => {
  it('sempre filtra pela conta e pelo projeto, como parâmetros', () => {
    const { sql, parametros } = traduzirFiltros('conta-1', 'projeto-1', {});

    expect(sql).toBe('WHERE c.conta_id = $1 AND c.projeto_id = $2');
    expect(parametros).toEqual(['conta-1', 'projeto-1']);
  });

  it('transforma cada filtro em parâmetro posicional, sem colocar valor no texto do SQL', () => {
    const perigoso = "x'; DROP TABLE comentarios; --";

    const { sql, parametros } = traduzirFiltros('c', 'p', {
      fonteId: 'f-1',
      unidade: perigoso,
      tema: 'price',
      sentimento: 'negative',
      de: new Date('2024-01-01T03:00:00Z'),
      ateExclusivo: new Date('2024-02-01T03:00:00Z'),
      precisaAcao: true,
    });

    expect(sql).not.toContain('DROP');
    expect(sql).not.toContain('f-1');
    expect(sql).toContain('c.fonte_id = $3');
    expect(sql).toContain('c.nome_unidade = $4');
    expect(sql).toContain('COALESCE(r.tema, cl.tema) = $5');
    expect(sql).toContain('COALESCE(r.sentimento, cl.sentimento) = $6');
    expect(sql).toContain('c.comentado_em >= $7');
    expect(sql).toContain('c.comentado_em < $8');
    expect(sql).toContain('cl.precisa_acao >= $9');
    expect(parametros).toEqual([
      'c',
      'p',
      'f-1',
      perigoso,
      'price',
      'negative',
      new Date('2024-01-01T03:00:00Z'),
      new Date('2024-02-01T03:00:00Z'),
      LIMIAR_PRECISA_ACAO,
    ]);
  });

  it('o filtro de período compara a data do comentário, então comentário sem data fica de fora', () => {
    const { sql } = traduzirFiltros('c', 'p', { de: new Date() });
    const semFiltro = traduzirFiltros('c', 'p', {});

    expect(sql).toContain('c.comentado_em >=');
    expect(semFiltro.sql).not.toContain('comentado_em');
  });

  it('aceita condições adicionais fixas, como a da fila de revisão', () => {
    const { sql } = traduzirFiltros('c', 'p', {}, ['cl.precisa_revisao']);

    expect(sql).toBe('WHERE c.conta_id = $1 AND c.projeto_id = $2 AND cl.precisa_revisao');
  });
});

describe('converterFiltros', () => {
  it('lê o período em horário de Brasília e inclui o último dia inteiro', () => {
    const filtros = converterFiltros({ de: '2024-03-10', ate: '2024-03-10', precisaAcao: 'true' });

    expect(filtros.de?.toISOString()).toBe('2024-03-10T03:00:00.000Z');
    expect(filtros.ateExclusivo?.toISOString()).toBe('2024-03-11T03:00:00.000Z');
    expect(filtros.precisaAcao).toBe(true);
  });

  it('deixa indefinido o que não foi pedido', () => {
    expect(converterFiltros({})).toEqual({
      fonteId: undefined,
      unidade: undefined,
      tema: undefined,
      sentimento: undefined,
      de: undefined,
      ateExclusivo: undefined,
      precisaAcao: undefined,
    });
  });
});

describe('estimativa de tempo da classificação', () => {
  it('a vazão é o menor entre concorrência × 60 ÷ latência e 1.200 por minuto', () => {
    expect(vazaoEfetivaPorMinuto(10)).toBe(600);
    expect(vazaoEfetivaPorMinuto(20)).toBe(1_200);
    expect(vazaoEfetivaPorMinuto(100)).toBe(1_200);
    expect(vazaoEfetivaPorMinuto(1)).toBe(60);
  });

  it('arredonda os minutos para cima', () => {
    expect(estimarMinutos(600, 10)).toBe(1);
    expect(estimarMinutos(601, 10)).toBe(2);
    expect(estimarMinutos(1, 10)).toBe(1);
    expect(estimarMinutos(1_200, 10)).toBe(2);
    expect(estimarMinutos(50_000, 10)).toBe(84);
    expect(estimarMinutos(50_000, 100)).toBe(42);
  });

  it('sem pendentes não há o que esperar', () => {
    expect(estimarMinutos(0, 10)).toBe(0);
  });
});
