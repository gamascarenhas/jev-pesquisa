import type { ProvedorDeIa } from './consumo.tipos.js';
import { custoDeTokens, type UnidadesUsd } from './valores-usd.js';

export const CARACTERES_POR_TOKEN_PADRAO = 4;

export interface PrecosPorMtok {
  jev: UnidadesUsd;
  llmEntrada: UnidadesUsd;
  llmSaida: UnidadesUsd;
}

export interface ConfiguracaoDoEstimador {
  precos: PrecosPorMtok;
  tokensSaidaDoLlm: number;
  caracteresPorToken?: number;
}

export interface EstimativaDaRequisicao {
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd8: UnidadesUsd;
}

export interface DiferencaDeEstimativa {
  tokensEstimados: number;
  tokensReais: number;
  diferencaDeTokens: number;
  diferencaUsd8: UnidadesUsd;
}

export interface EstatisticasDeCalibracao {
  amostras: number;
  tokensEstimados: number;
  tokensReais: number;
}

export interface EstimadorDeCusto {
  estimar(provedor: ProvedorDeIa, caracteresEntrada: number): EstimativaDaRequisicao;
  custoReal(provedor: ProvedorDeIa, tokensEntrada: number, tokensSaida: number): UnidadesUsd;
  registrarDiferenca(
    estimada: EstimativaDaRequisicao,
    tokensEntradaReais: number,
    tokensSaidaReais: number,
    custoRealUsd8: UnidadesUsd,
  ): DiferencaDeEstimativa;
  estatisticas(): EstatisticasDeCalibracao;
}

export function criarEstimadorDeCusto(configuracao: ConfiguracaoDoEstimador): EstimadorDeCusto {
  const { precos, tokensSaidaDoLlm } = configuracao;
  const caracteresPorToken = configuracao.caracteresPorToken ?? CARACTERES_POR_TOKEN_PADRAO;
  const calibracao: EstatisticasDeCalibracao = { amostras: 0, tokensEstimados: 0, tokensReais: 0 };

  function custoReal(provedor: ProvedorDeIa, tokensEntrada: number, tokensSaida: number): bigint {
    // Os tokens de saída do Jev não são cobrados.
    return provedor === 'jev'
      ? custoDeTokens(tokensEntrada, precos.jev)
      : custoDeTokens(tokensEntrada, precos.llmEntrada) +
          custoDeTokens(tokensSaida, precos.llmSaida);
  }

  return {
    estimar(provedor, caracteresEntrada) {
      const tokensEntrada = Math.ceil(caracteresEntrada / caracteresPorToken);
      const tokensSaida = provedor === 'llm' ? tokensSaidaDoLlm : 0;
      return {
        tokensEntrada,
        tokensSaida,
        custoUsd8: custoReal(provedor, tokensEntrada, tokensSaida),
      };
    },

    custoReal,

    registrarDiferenca(estimada, tokensEntradaReais, tokensSaidaReais, custoRealUsd8) {
      const tokensEstimados = estimada.tokensEntrada + estimada.tokensSaida;
      const tokensReais = tokensEntradaReais + tokensSaidaReais;
      calibracao.amostras += 1;
      calibracao.tokensEstimados += tokensEstimados;
      calibracao.tokensReais += tokensReais;
      return {
        tokensEstimados,
        tokensReais,
        diferencaDeTokens: tokensReais - tokensEstimados,
        diferencaUsd8: custoRealUsd8 - estimada.custoUsd8,
      };
    },

    estatisticas: () => ({ ...calibracao }),
  };
}
