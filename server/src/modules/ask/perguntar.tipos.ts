import type { EntradaDosFiltros } from '../comments/comentarios.servico.js';

export const MAX_TOKENS_INTERPRETACAO = 500;
export const LIMIAR_PROVAVELMENTE_SIM = 0.7;
export const LIMIAR_PROVAVELMENTE_NAO = 0.3;
export const TAMANHO_MAXIMO_DA_PERGUNTA = 500;
export const MAX_CARACTERES_POR_COMENTARIO = 4_000;
export const TAMANHO_LOTE_DA_PERGUNTA = 50;
export const PERGUNTAS_NO_HISTORICO = 20;
export const NOME_DA_PERGUNTA_NO_JEV = 'answer';

export type StatusDaPergunta =
  | 'interpreting'
  | 'awaiting_confirmation'
  | 'not_answerable'
  | 'running'
  | 'paused_limit'
  | 'done'
  | 'failed';

export interface CriteriosDoJev {
  true: string;
  false: string;
}

export interface PerguntaGravada {
  id: string;
  textoOriginal: string;
  hashPergunta: string;
  respondivel: boolean | null;
  instrucoes: string | null;
  criterios: CriteriosDoJev | null;
  interpretacao: string | null;
  motivoNaoRespondivel: string | null;
  filtros: EntradaDosFiltros;
  totalAlvo: number | null;
  status: StatusDaPergunta;
  criadoEm: Date;
}

export interface InterpretacaoGravada {
  respondivel: boolean;
  instrucoes: string | null;
  criterios: CriteriosDoJev | null;
  interpretacao: string;
  motivoNaoRespondivel: string | null;
}
