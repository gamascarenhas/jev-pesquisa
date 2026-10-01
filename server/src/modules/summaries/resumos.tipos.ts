export const NIVEIS_DE_ALERTA = ['critical', 'attention', 'stable'] as const;
export type NivelDeAlerta = (typeof NIVEIS_DE_ALERTA)[number];

export type StatusDoResumo =
  'generating' | 'ready' | 'numbers_only' | 'too_few_comments' | 'failed';

export interface UnidadePrincipal {
  unidade: string;
  total: number;
  participacao: number;
}

export interface Variacoes {
  volume: number | null;
  negativos: number | null;
  percentualNegativo: number | null;
}

export interface Agregados {
  volume: number;
  negativos: number;
  percentualNegativo: number;
  gravidadeMedia: number;
  percentualPrecisaAcao: number;
  unidadesPrincipais: UnidadePrincipal[];
  anterior: { volume: number; negativos: number; percentualNegativo: number } | null;
  variacoes: Variacoes | null;
}

export interface AmostraDoResumo {
  /** Identificador curto (c1, c2...) que o texto gerado usa para citar o comentário. */
  id: string;
  comentarioId: string;
  texto: string;
}

export interface Evidencia {
  id: string;
  comentarioId: string;
}

export interface Achado {
  texto: string;
  evidencias: Evidencia[];
  suporte: number;
}
