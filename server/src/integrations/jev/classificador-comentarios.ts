import type { EntryType, Questions, SystemOneResult } from '@typesafe-ai/sdk';

import { perguntasDoComentario } from '../../modules/classification/questions.js';

export interface UsoDoJev {
  tokensEntrada: number;
  tokensSaida: number;
}

export interface ResultadoDoJev<Q extends Questions> {
  modelo: string;
  respostas: SystemOneResult<Q>['answers'];
  /** Uso da tentativa que respondeu. */
  uso: UsoDoJev;
  /** Tentativas anteriores que podem ter sido cobradas (timeout, queda, 5xx): o custo delas é a estimativa. */
  tentativasAmbiguas: number;
}

export interface OpcoesDeAvaliacao {
  sinal?: AbortSignal | undefined;
}

export interface EstadoDoComentario {
  comment: string;
  rating: number | null;
  location: string | null;
}

export type RespostasDoComentario = ResultadoDoJev<typeof perguntasDoComentario>;

export interface ClassificadorDeComentarios {
  avaliar<const Q extends Questions>(
    state: EntryType,
    perguntas: Q,
    opcoes?: OpcoesDeAvaliacao,
  ): Promise<ResultadoDoJev<Q>>;
  classificarComentario(
    estado: EstadoDoComentario,
    opcoes?: OpcoesDeAvaliacao,
  ): Promise<RespostasDoComentario>;
}

export type Avaliar = ClassificadorDeComentarios['avaliar'];

// A classificação padrão é um caso do método genérico: uma requisição com todas as perguntas juntas.
export function criarClassificador(avaliar: Avaliar): ClassificadorDeComentarios {
  return {
    avaliar,
    classificarComentario: (estado, opcoes) =>
      avaliar({ ...estado }, perguntasDoComentario, opcoes),
  };
}
