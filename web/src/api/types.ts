export type Papel = 'owner' | 'member';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  emailConfirmado: boolean;
  criadoEm: string;
}

export interface Convite {
  id: string;
  email: string;
  papel: Papel;
  criadoEm: string;
  expiraEm: string;
}

export interface Projeto {
  id: string;
  nome: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Conta {
  id: string;
  nome: string;
  plano: { id: string; nome: string };
  cicloTerminaEm: string;
}

export interface ConfiguracaoPublica {
  nomeNegocio: string;
  cobrancaAtivada: boolean;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface Lista<T> {
  itens: T[];
}

export interface Mensagem {
  mensagem: string;
}

export interface MapeamentoDeColunas {
  comentario: number;
  data?: number | undefined;
  nota?: number | undefined;
  unidade?: number | undefined;
  autor?: number | undefined;
}

export interface PreviaDoEnvio {
  envioId: string;
  tipo: 'csv' | 'xlsx';
  nomeArquivo: string;
  abas: string[];
  aba: string | null;
  cabecalho: string[];
  linhas: string[][];
  totalLinhas: number;
  sugestao: Partial<MapeamentoDeColunas>;
}

export interface ResumoDaImportacao {
  total: number;
  processadas: number;
  importados: number;
  ignorados: number;
  duplicados: number;
  concluida: boolean;
}

export interface FonteImportada {
  id: string;
  nome: string;
  importacao: ResumoDaImportacao | null;
  criadoEm: string;
}

export interface ConfirmacaoDoEnvio {
  trabalhoId: string;
  fonteId: string;
}

export type StatusDoTrabalho =
  'pending' | 'running' | 'paused_limit' | 'done' | 'failed' | 'cancelled';

export interface Trabalho {
  id: string;
  tipo: string;
  status: StatusDoTrabalho;
  projetoId: string | null;
  progresso: { total: number; feito: number };
  criadoEm: string;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
}

export interface FiltrosDoPainel {
  fonteId?: string | undefined;
  unidade?: string | undefined;
  tema?: string | undefined;
  sentimento?: string | undefined;
  de?: string | undefined;
  ate?: string | undefined;
  precisaAcao?: boolean | undefined;
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

export interface DadosDoPainel {
  resumo: ResumoDoPainel;
  temas: ContagemTemaSentimento[];
  gravidade: ContagemDeGravidade[];
}

export interface OpcoesDoPainel {
  fontes: { id: string; nome: string }[];
  unidades: string[];
}

export interface Comentario {
  id: string;
  textoOriginal: string | null;
  fonte: string;
  unidade: string | null;
  autor: string | null;
  comentadoEm: string | null;
  nota: number | null;
  tema: string | null;
  sentimento: string | null;
  temaDoModelo: string | null;
  sentimentoDoModelo: string | null;
  temaConfianca: number | null;
  sentimentoConfianca: number | null;
  gravidade: number | null;
  precisaAcao: boolean | null;
  precisaRevisao: boolean;
  foiRevisado: boolean;
  status: string;
}

export interface EstimativaDaClassificacao {
  pendentes: number;
  minutosEstimados: number;
  porcentagemEstimada: number;
  porcentagemJaConsumida: number;
  cabe: boolean;
}

export interface ProgressoDaClassificacao {
  pendentes: number;
  classificados: number;
  falhos: number;
  semTexto: number;
  trabalho: { id: string; status: StatusDoTrabalho } | null;
}

export interface InicioDaClassificacao {
  trabalhoId: string;
  status: StatusDoTrabalho;
  jaExistia: boolean;
}

export interface ConsumoDoPlano {
  porcentagem: number;
  limiteAtingido: boolean;
  cicloTerminaEm: string;
}

export interface Plano {
  id: string;
  nome: string;
  precoMensalCentavos: number;
}

export interface UnidadeSincronizada {
  nomeUnidade: string;
  titulo: string;
  ultimaSincronizacaoEm: string | null;
  falha: { codigo: string; mensagem: string } | null;
}

export interface StatusDoGoogle {
  conectado: boolean;
  email: string | null;
  simulado: boolean;
  sincronizando: boolean;
  unidades: UnidadeSincronizada[];
}

export interface ContaDoGoogle {
  id: string;
  nome: string;
  unidades: { nome: string; titulo: string; endereco: string | null; selecionada: boolean }[];
}

export interface InicioDaSincronizacao {
  trabalhoId: string;
}
