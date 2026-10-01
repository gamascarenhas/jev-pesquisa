import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { criarEstimadorDeCusto } from '../../../src/modules/usage/estimador-custo.js';
import {
  custoDeTokens,
  dividirParaCima,
  porcentagem,
  precoPorMtokParaUnidades,
  unidadesParaUsdTexto,
  usdTextoParaUnidades,
} from '../../../src/modules/usage/valores-usd.js';

describe('valores em USD', () => {
  it('converte texto do banco em unidades de 1e-8 USD e volta, sem perder casas', () => {
    expect(usdTextoParaUnidades('1.000000')).toBe(100_000_000n);
    expect(usdTextoParaUnidades('0.00000001')).toBe(1n);
    expect(usdTextoParaUnidades('12345.12345678')).toBe(1_234_512_345_678n);
    expect(usdTextoParaUnidades('0')).toBe(0n);
    expect(unidadesParaUsdTexto(1n)).toBe('0.00000001');
    expect(unidadesParaUsdTexto(1_234_512_345_678n)).toBe('12345.12345678');
    expect(unidadesParaUsdTexto(0n)).toBe('0.00000000');
  });

  it('soma valores minúsculos sem o erro de ponto flutuante', () => {
    const somaFlutuante = 0.1 + 0.2;
    const somaInteira = usdTextoParaUnidades('0.10000000') + usdTextoParaUnidades('0.20000000');

    expect(somaFlutuante).not.toBe(0.3);
    expect(unidadesParaUsdTexto(somaInteira)).toBe('0.30000000');
    expect(Array.from({ length: 10_000 }, () => 1n).reduce((a, b) => a + b, 0n)).toBe(10_000n);
  });

  it('converte o preço por milhão de tokens da configuração sem arredondar errado', () => {
    expect(precoPorMtokParaUnidades(0.042)).toBe(4_200_000n);
    expect(precoPorMtokParaUnidades(15)).toBe(1_500_000_000n);
    expect(precoPorMtokParaUnidades(0.1 + 0.2)).toBe(30_000_000n);
  });

  it('arredonda o custo de tokens sempre para cima, em inteiros', () => {
    expect(custoDeTokens(1_000_000, 4_200_000n)).toBe(4_200_000n);
    expect(custoDeTokens(1_000_001, 4_200_000n)).toBe(4_200_005n);
    expect(custoDeTokens(1, 4_200_000n)).toBe(5n);
    expect(custoDeTokens(0, 4_200_000n)).toBe(0n);
    expect(dividirParaCima(7n, 2n)).toBe(4n);
  });

  it('calcula porcentagem com divisão inteira', () => {
    expect(porcentagem(50n, 200n)).toBe(25);
    expect(porcentagem(1n, 3n)).toBe(33.33);
    expect(porcentagem(10n, 0n)).toBe(0);
  });
});

describe('estimador de custo', () => {
  const precos = { jev: 4_200_000n, llmEntrada: 100_000_000n, llmSaida: 500_000_000n };
  const estimador = criarEstimadorDeCusto({ precos, tokensSaidaDoLlm: 1_200 });

  it('estima tokens por caracteres divididos por 4, arredondando para cima', () => {
    expect(estimador.estimar('jev', 4_000)).toMatchObject({ tokensEntrada: 1_000, tokensSaida: 0 });
    expect(estimador.estimar('jev', 4_001).tokensEntrada).toBe(1_001);
    expect(
      criarEstimadorDeCusto({ precos, tokensSaidaDoLlm: 1, caracteresPorToken: 2 }).estimar(
        'jev',
        4_000,
      ).tokensEntrada,
    ).toBe(2_000);
  });

  it('cobra só os tokens de entrada do Jev', () => {
    expect(estimador.custoReal('jev', 1_000_000, 999_999)).toBe(4_200_000n);
  });

  it('cobra entrada e saída do LLM, e estima a saída pelo máximo configurado', () => {
    const estimativa = estimador.estimar('llm', 40_000);

    expect(estimativa.tokensSaida).toBe(1_200);
    expect(estimativa.custoUsd8).toBe(
      custoDeTokens(10_000, 100_000_000n) + custoDeTokens(1_200, 500_000_000n),
    );
    expect(estimador.custoReal('llm', 1_000_000, 1_000_000)).toBe(600_000_000n);
  });

  it('registra a diferença entre o estimado e o real e acumula para calibrar', () => {
    const calibrador = criarEstimadorDeCusto({ precos, tokensSaidaDoLlm: 0 });
    const estimada = calibrador.estimar('jev', 4_000);

    const diferenca = calibrador.registrarDiferenca(
      estimada,
      1_300,
      0,
      calibrador.custoReal('jev', 1_300, 0),
    );
    calibrador.registrarDiferenca(estimada, 900, 0, calibrador.custoReal('jev', 900, 0));

    expect(diferenca).toEqual({
      tokensEstimados: 1_000,
      tokensReais: 1_300,
      diferencaDeTokens: 300,
      diferencaUsd8: custoDeTokens(1_300, 4_200_000n) - custoDeTokens(1_000, 4_200_000n),
    });
    expect(calibrador.estatisticas()).toEqual({
      amostras: 2,
      tokensEstimados: 2_000,
      tokensReais: 2_200,
    });
  });
});

function listarArquivos(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = join(diretorio, nome);
    return statSync(caminho).isDirectory() ? listarArquivos(caminho) : [caminho];
  });
}

describe('fronteira do módulo usage', () => {
  const raiz = join(import.meta.dirname, '../../../src');
  const arquivos = listarArquivos(raiz).filter((caminho) => caminho.endsWith('.ts'));
  const fora = arquivos.filter(
    (caminho) => !relative(raiz, caminho).startsWith(`modules${sep}usage`),
  );

  it('nenhum arquivo de fora importa o estimador, o repositório ou os tipos internos de usage', () => {
    const proibidos = fora.filter((caminho) =>
      /from '[^']*modules\/usage\/(?!controle-custo(\.servico|-sistema)|consumo\.rotas)[^']*'/.test(
        readFileSync(caminho, 'utf8'),
      ),
    );

    expect(proibidos.map((caminho) => relative(raiz, caminho))).toEqual([]);
  });

  it('ninguém de fora referencia o estimador de custo', () => {
    const importaEstimador = fora.filter((caminho) =>
      readFileSync(caminho, 'utf8').includes('estimador-custo'),
    );

    expect(importaEstimador.map((caminho) => relative(raiz, caminho))).toEqual([]);
  });
});
