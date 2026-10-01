import { describe, expect, it } from 'vitest';

import { calcularAtrasoDeRetentativa } from '../../../src/jobs/executor-trabalhos.js';

describe('calcularAtrasoDeRetentativa', () => {
  it('cresce de forma exponencial a cada tentativa, sem jitter', () => {
    const atrasos = [1, 2, 3, 4].map((tentativa) =>
      calcularAtrasoDeRetentativa(tentativa, () => 1),
    );

    expect(atrasos).toEqual([5_000, 10_000, 20_000, 40_000]);
  });

  it('aplica jitter entre 50% e 100% do atraso', () => {
    expect(calcularAtrasoDeRetentativa(3, () => 0)).toBe(10_000);
    expect(calcularAtrasoDeRetentativa(3, () => 0.5)).toBe(15_000);
    expect(calcularAtrasoDeRetentativa(3, () => 1)).toBe(20_000);
  });

  it('nunca passa de 15 minutos', () => {
    expect(calcularAtrasoDeRetentativa(30, () => 1)).toBe(900_000);
  });
});
