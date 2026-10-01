export type TipoDeArquivo = 'csv' | 'xlsx';

export type CelulaBruta = string | number | Date | null;

export interface Mapeamento {
  comentario: number;
  data?: number | undefined;
  nota?: number | undefined;
  unidade?: number | undefined;
  autor?: number | undefined;
}

export interface PreviaDoEnvio {
  envioId: string;
  tipo: TipoDeArquivo;
  nomeArquivo: string;
  abas: string[];
  aba: string | null;
  cabecalho: string[];
  linhas: string[][];
  totalLinhas: number;
  sugestao: Partial<Mapeamento>;
}

export interface ResumoDaImportacao {
  total: number;
  processadas: number;
  importados: number;
  ignorados: number;
  duplicados: number;
  concluida: boolean;
}
