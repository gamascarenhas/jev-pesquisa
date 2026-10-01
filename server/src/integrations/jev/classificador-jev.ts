import {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  TypeSafeClient,
  type EntryType,
  type Fetch,
  type Questions,
  type RetryPolicy,
} from '@typesafe-ai/sdk';

import { ErroDeIaAmbiguo, ErroDeIaNaoCobrado } from '../../modules/usage/controle-custo.servico.js';
import {
  criarClassificador,
  type ClassificadorDeComentarios,
} from './classificador-comentarios.js';

export const TEMPO_LIMITE_JEV_POR_TENTATIVA_MS = 20_000;
// O SDK repete sozinho até 2 vezes (408, 429 e 5xx, com backoff); não somamos outra camada de repetição.
export const REPETICOES_DO_SDK = 2;
// Respostas que o Jev devolve sem processar o comentário, portanto sem cobrança.
const STATUS_SEM_COBRANCA = new Set([400, 401, 403, 404, 422, 429, 529]);

export interface OpcoesDoClassificadorJev {
  chaveApi: string;
  modelo: string;
  urlBase?: string | undefined;
  fetch?: Fetch | undefined;
  repeticao?: Partial<RetryPolicy> | undefined;
  tempoLimiteMs?: number | undefined;
}

interface RegistroDeTentativa {
  /** `undefined` quando a conexão falhou antes de haver resposta. */
  status: number | undefined;
}

function criarContadorDeTentativas(base: Fetch): {
  fetch: Fetch;
  tentativas: RegistroDeTentativa[];
} {
  const tentativas: RegistroDeTentativa[] = [];
  const contador: Fetch = async (entrada, init) => {
    try {
      const resposta = await base(entrada, init);
      tentativas.push({ status: resposta.status });
      return resposta;
    } catch (erro) {
      tentativas.push({ status: undefined });
      throw erro;
    }
  };
  return { fetch: contador, tentativas };
}

function resultouEmSucesso(status: number | undefined): boolean {
  return status !== undefined && status >= 200 && status < 300;
}

// Uma tentativa é ambígua quando o Jev pode ter processado e cobrado sem que o corpo chegasse inteiro.
function contarTentativasAmbiguas(
  tentativas: RegistroDeTentativa[],
  terminouComSucesso: boolean,
): number {
  return tentativas.filter(({ status }, indice) => {
    if (status === undefined) {
      return true;
    }
    if (resultouEmSucesso(status)) {
      return indice < tentativas.length - 1 || !terminouComSucesso;
    }
    return !STATUS_SEM_COBRANCA.has(status);
  }).length;
}

function descreverFalha(erro: unknown): string {
  if (erro instanceof APIError) {
    return `O Jev respondeu ${String(erro.status)} (requisição ${erro.requestId ?? 'sem id'}).`;
  }
  if (erro instanceof APIConnectionError) {
    return 'Falha de conexão com o Jev.';
  }
  return erro instanceof APIUserAbortError
    ? 'A chamada ao Jev foi cancelada.'
    : 'Falha ao chamar o Jev.';
}

// Mensagens próprias: o corpo do erro do SDK pode ecoar o state, que contém texto de comentário.
function traduzirFalha(erro: unknown, tentativas: RegistroDeTentativa[]): Error {
  const ambiguas = contarTentativasAmbiguas(tentativas, false);
  const mensagem = descreverFalha(erro);
  if (erro instanceof APIUserAbortError) {
    return new ErroDeIaAmbiguo(mensagem, Math.max(1, ambiguas));
  }
  return ambiguas === 0
    ? new ErroDeIaNaoCobrado(mensagem)
    : new ErroDeIaAmbiguo(mensagem, ambiguas);
}

export function criarClassificadorJev(
  opcoes: OpcoesDoClassificadorJev,
): ClassificadorDeComentarios {
  async function avaliar<const Q extends Questions>(
    state: EntryType,
    perguntas: Q,
    opcoesDaChamada?: { sinal?: AbortSignal | undefined },
  ) {
    const contador = criarContadorDeTentativas(opcoes.fetch ?? fetch);
    const cliente = new TypeSafeClient({
      apiKey: opcoes.chaveApi,
      defaultModel: opcoes.modelo,
      timeout: opcoes.tempoLimiteMs ?? TEMPO_LIMITE_JEV_POR_TENTATIVA_MS,
      retry: { maxRetries: REPETICOES_DO_SDK, ...opcoes.repeticao },
      fetch: contador.fetch,
      logLevel: 'off',
      ...(opcoes.urlBase === undefined ? {} : { baseURL: opcoes.urlBase }),
    });
    try {
      const resultado = await cliente.systemOne(
        { state, questions: perguntas, model: opcoes.modelo },
        opcoesDaChamada?.sinal === undefined ? {} : { signal: opcoesDaChamada.sinal },
      );
      return {
        modelo: resultado.model,
        respostas: resultado.answers,
        uso: {
          tokensEntrada: resultado.usage.input_tokens,
          tokensSaida: resultado.usage.output_tokens,
        },
        tentativasAmbiguas: contarTentativasAmbiguas(contador.tentativas, true),
      };
    } catch (erro) {
      throw traduzirFalha(erro, contador.tentativas);
    }
  }
  return criarClassificador(avaliar);
}
