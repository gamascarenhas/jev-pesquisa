import type { Agregados, NivelDeAlerta } from './resumos.tipos.js';

export const VOLUME_MINIMO_PARA_RESUMIR = 10;
export const LIMIAR_GRAVIDADE_CRITICA = 0.6;
export const LIMIAR_GRAVIDADE_ATENCAO = 0.4;
export const LIMIAR_CRESCIMENTO_NEGATIVOS_CRITICO = 50;
export const LIMIAR_CRESCIMENTO_NEGATIVOS_ATENCAO = 20;
export const LIMIAR_PERCENTUAL_NEGATIVO_ATENCAO = 50;
export const LIMIAR_PERCENTUAL_PRECISA_ACAO_CRITICO = 50;
export const LIMIAR_PERCENTUAL_PRECISA_ACAO_ATENCAO = 30;

function atinge(valor: number | null | undefined, limiar: number): boolean {
  return valor !== null && valor !== undefined && valor >= limiar;
}

// Só regras sobre os números: o LLM nunca decide o alerta.
export function calcularNivelDeAlerta(agregados: Agregados): NivelDeAlerta {
  if (agregados.volume < VOLUME_MINIMO_PARA_RESUMIR) {
    return 'stable';
  }
  const crescimento = agregados.variacoes?.negativos;
  const critico =
    agregados.gravidadeMedia >= LIMIAR_GRAVIDADE_CRITICA ||
    atinge(crescimento, LIMIAR_CRESCIMENTO_NEGATIVOS_CRITICO) ||
    agregados.percentualPrecisaAcao >= LIMIAR_PERCENTUAL_PRECISA_ACAO_CRITICO;
  if (critico) {
    return 'critical';
  }
  const atencao =
    agregados.gravidadeMedia >= LIMIAR_GRAVIDADE_ATENCAO ||
    atinge(crescimento, LIMIAR_CRESCIMENTO_NEGATIVOS_ATENCAO) ||
    agregados.percentualNegativo >= LIMIAR_PERCENTUAL_NEGATIVO_ATENCAO ||
    agregados.percentualPrecisaAcao >= LIMIAR_PERCENTUAL_PRECISA_ACAO_ATENCAO;
  return atencao ? 'attention' : 'stable';
}
