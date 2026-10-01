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
