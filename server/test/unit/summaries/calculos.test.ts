import { describe, expect, it } from 'vitest';

import { agregar } from '../../../src/modules/summaries/agregar.js';
import { calcularHashDeDados } from '../../../src/modules/summaries/hash-dados.js';
import {
  calcularNivelDeAlerta,
  VOLUME_MINIMO_PARA_RESUMIR,
} from '../../../src/modules/summaries/nivel-alerta.js';
import type { Agregados } from '../../../src/modules/summaries/resumos.tipos.js';

function bruto(sobrescritas: Partial<Parameters<typeof agregar>[0]> = {}) {
  return {
    volume: 40,
    negativos: 10,
    somaDaGravidade: 8,
    precisamDeAcao: 4,
    unidadesPrincipais: [
      { unidade: 'Centro', total: 20 },
      { unidade: 'Sul', total: 10 },
    ],
    ...sobrescritas,
  };
}

function agregados(sobrescritas: Partial<Agregados> = {}): Agregados {
  return { ...agregar(bruto(), null), ...sobrescritas };
}

describe('agregação feita pelo código', () => {
  it('calcula porcentagens, gravidade média e participação das unidades', () => {
    const resultado = agregar(bruto(), null);

    expect(resultado).toMatchObject({
      volume: 40,
      percentualNegativo: 25,
      gravidadeMedia: 0.2,
      percentualPrecisaAcao: 10,
    });
    expect(resultado.unidadesPrincipais).toEqual([
      { unidade: 'Centro', total: 20, participacao: 50 },
      { unidade: 'Sul', total: 10, participacao: 25 },
    ]);
  });

  it('calcula as variações contra o período anterior', () => {
    const resultado = agregar(bruto(), bruto({ volume: 20, negativos: 4 }));

    expect(resultado.variacoes).toEqual({ volume: 100, negativos: 150, percentualNegativo: 5 });
  });

  it('sem período anterior comparável, traz só os totais e nenhuma variação', () => {
    expect(agregar(bruto(), null).variacoes).toBeNull();
    expect(agregar(bruto(), bruto({ volume: 0, negativos: 0 })).variacoes).toBeNull();
  });
});

describe('nível de alerta', () => {
  it('volume pequeno é sempre estável', () => {
    const pequeno = agregados({ volume: VOLUME_MINIMO_PARA_RESUMIR - 1, gravidadeMedia: 1 });

    expect(calcularNivelDeAlerta(pequeno)).toBe('stable');
  });

  it('gravidade alta ou muita ação necessária é crítico', () => {
    expect(calcularNivelDeAlerta(agregados({ gravidadeMedia: 0.7 }))).toBe('critical');
    expect(calcularNivelDeAlerta(agregados({ percentualPrecisaAcao: 55 }))).toBe('critical');
  });

  it('crescimento forte do volume negativo é crítico e moderado pede atenção', () => {
    const com = (negativos: number) =>
      agregados({ variacoes: { volume: 0, negativos, percentualNegativo: 0 } });

    expect(calcularNivelDeAlerta(com(60))).toBe('critical');
    expect(calcularNivelDeAlerta(com(25))).toBe('attention');
    expect(calcularNivelDeAlerta(com(5))).toBe('stable');
  });

  it('muitos negativos pedem atenção e o resto é estável', () => {
    expect(calcularNivelDeAlerta(agregados({ percentualNegativo: 60 }))).toBe('attention');
    expect(calcularNivelDeAlerta(agregados())).toBe('stable');
  });
});

describe('hash dos dados', () => {
  it('muda com os comentários ou com os agregados e se repete com os mesmos', () => {
    const base = calcularHashDeDados('a', agregados());

    expect(calcularHashDeDados('a', agregados())).toBe(base);
    expect(calcularHashDeDados('b', agregados())).not.toBe(base);
    expect(calcularHashDeDados('a', agregados({ volume: 41 }))).not.toBe(base);
  });
});
