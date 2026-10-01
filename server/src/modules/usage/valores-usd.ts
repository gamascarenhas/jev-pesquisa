// Todo valor em USD é um bigint em unidades de 1e-8 USD; texto só na fronteira com o banco.
export type UnidadesUsd = bigint;

const CASAS_DECIMAIS = 8;
const MILHAO = 1_000_000n;

export function usdTextoParaUnidades(texto: string): UnidadesUsd {
  const [inteira = '0', fracao = ''] = texto.trim().split('.');
  return BigInt(inteira + fracao.padEnd(CASAS_DECIMAIS, '0').slice(0, CASAS_DECIMAIS));
}

export function unidadesParaUsdTexto(unidades: UnidadesUsd): string {
  const digitos = unidades.toString().padStart(CASAS_DECIMAIS + 1, '0');
  return `${digitos.slice(0, -CASAS_DECIMAIS)}.${digitos.slice(-CASAS_DECIMAIS)}`;
}

export function dividirParaCima(dividendo: bigint, divisor: bigint): bigint {
  return (dividendo + divisor - 1n) / divisor;
}

export function custoDeTokens(tokens: number, precoPorMtok: UnidadesUsd): UnidadesUsd {
  return dividirParaCima(BigInt(tokens) * precoPorMtok, MILHAO);
}

// O preço vem da configuração como número decimal; a conversão passa por texto para não haver aritmética de ponto flutuante.
export function precoPorMtokParaUnidades(preco: number): UnidadesUsd {
  return usdTextoParaUnidades(preco.toFixed(CASAS_DECIMAIS));
}

export function porcentagem(parte: UnidadesUsd, total: UnidadesUsd): number {
  if (total <= 0n) {
    return 0;
  }
  return Number((parte * 10_000n) / total) / 100;
}
