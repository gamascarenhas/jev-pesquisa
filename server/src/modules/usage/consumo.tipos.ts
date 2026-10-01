import type { UnidadesUsd } from './valores-usd.js';

export type ProvedorDeIa = 'jev' | 'llm';

export type OperacaoDeIa =
  'classify' | 'ask' | 'interpret_question' | 'summarize' | 'verify_summary';

export interface ReferenciasDaReserva {
  comentarioRef?: string | undefined;
  perguntaPersonalizadaRef?: string | undefined;
  resumoRef?: string | undefined;
}

export interface RequisicaoDeIa extends ReferenciasDaReserva {
  provedor: ProvedorDeIa;
  operacao: OperacaoDeIa;
  caracteresEntrada: number;
  modelo?: string | undefined;
}

export interface ReservaAtiva {
  id: string;
  provedor: ProvedorDeIa;
  operacao: OperacaoDeIa;
  tokensEntradaEstimados: number;
  tokensSaidaEstimados: number;
  estimadoUsd8: UnidadesUsd;
}

export interface UsoReal {
  tokensEntrada: number;
  tokensSaida: number;
}

/** `uso` soma todas as tentativas conhecidas; sem ele, o custo é a estimativa vezes `tentativas`. */
export interface RespostaDeIa<T> {
  valor: T;
  uso?: UsoReal | undefined;
  tentativas?: number | undefined;
}

/** A requisição falhou antes de qualquer cobrança (401, 422, erro antes de o corpo sair). */
export class ErroDeIaNaoCobrado extends Error {
  constructor(mensagem = 'A requisição de IA falhou antes de ser cobrada.') {
    super(mensagem);
    this.name = 'ErroDeIaNaoCobrado';
  }
}

/** Timeout ou queda depois do envio: o serviço pode ter cobrado, então a estimativa é liquidada. */
export class ErroDeIaAmbiguo extends Error {
  constructor(
    mensagem = 'O resultado da requisição de IA é incerto.',
    readonly tentativas = 1,
  ) {
    super(mensagem);
    this.name = 'ErroDeIaAmbiguo';
  }
}

export type ResultadoDoItem<T> = { ok: true; valor: T } | { ok: false; erro: unknown };

export interface ResultadoDoLote<T> {
  /** Alinhado a `requisicoes`; `undefined` para o que não coube no limite. */
  resultados: (ResultadoDoItem<T> | undefined)[];
  naoReservados: number[];
}

export interface EstimativaDoPlano {
  porcentagemEstimada: number;
  porcentagemJaConsumida: number;
  cabe: boolean;
}
