export interface ComentarioParaImportar {
  texto: string;
  nota: number | null;
  unidade: string | null;
  autor: string | null;
  comentadoEm: Date | null;
}

export interface ResultadoDoLote {
  inseridos: number;
  duplicados: number;
}

export interface ComentarioListado {
  id: string;
  textoOriginal: string | null;
  fonte: string;
  unidade: string | null;
  autor: string | null;
  comentadoEm: Date | null;
  nota: number | null;
  tema: string | null;
  sentimento: string | null;
  temaDoModelo: string | null;
  sentimentoDoModelo: string | null;
  temaConfianca: number | null;
  sentimentoConfianca: number | null;
  gravidade: number | null;
  precisaAcao: number | null;
  precisaRevisao: boolean;
  foiRevisado: boolean;
  statusClassificacao: string;
}

export interface ResumoDoPainel {
  total: number;
  classificados: number;
  pendentesDeRevisao: number;
  notaMedia: number | null;
}

export interface ContagemTemaSentimento {
  tema: string;
  sentimento: string;
  total: number;
}

export interface ContagemDeGravidade {
  nivel: number;
  total: number;
}

export interface OpcoesDeFiltro {
  fontes: { id: string; nome: string }[];
  unidades: string[];
}

export interface ComentarioExterno {
  idExterno: string;
  /** Nulo quando a avaliação traz só estrelas. */
  texto: string | null;
  nota: number | null;
  unidade: string | null;
  autor: string | null;
  comentadoEm: Date | null;
  atualizadoEm: Date;
}

export interface ResultadoDaSincronizacao {
  inseridos: number;
  atualizados: number;
  semTexto: number;
}

export interface FiltroDoResumo {
  tema: string;
  unidade?: string | undefined;
  de?: Date | undefined;
  ateExclusivo?: Date | undefined;
}

export interface AgregadoDoTema {
  volume: number;
  negativos: number;
  somaDaGravidade: number;
  precisamDeAcao: number;
  unidadesPrincipais: { unidade: string; total: number }[];
}

export interface CandidatoDoResumo {
  id: string;
  textoMascarado: string;
  comentadoEm: Date | null;
  unidade: string | null;
  gravidade: number;
  confiancaDoTema: number;
}

export interface ComentarioCitado {
  id: string;
  texto: string | null;
  nota: number | null;
  unidade: string | null;
  comentadoEm: Date | null;
}

export type FaixaDaPergunta = 'yes' | 'uncertain' | 'no';

export interface LimiaresDeFaixa {
  provavelmenteSim: number;
  provavelmenteNao: number;
}

export interface ContagemPorFaixa {
  sim: number;
  incerto: number;
  nao: number;
}

export interface AlvoDaPergunta {
  id: string;
  /** Tamanho do texto mascarado, já limitado, para estimar o consumo antes de confirmar. */
  tamanho: number;
}

export interface TextoParaPergunta {
  id: string;
  textoMascarado: string;
  nota: number | null;
  unidade: string | null;
}

export interface RespostaListada extends ComentarioListado {
  probabilidade: number;
}
