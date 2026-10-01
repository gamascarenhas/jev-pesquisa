import type { EntryType, Questions, SystemOneResult } from '@typesafe-ai/sdk';

import {
  criarClassificador,
  type ClassificadorDeComentarios,
} from './classificador-comentarios.js';
import { analisar, arredondar, fracaoCoberta, type Analise } from './regras-simuladas.js';

export const MODELO_SIMULADO = 'jev-simulado';
const CARACTERES_POR_TOKEN_SIMULADO = 4;
const TOKENS_DE_SAIDA_POR_PERGUNTA = 10;

function distribuir(rotulos: string[], escolhido: string, probabilidade: number) {
  const resto = rotulos.length > 1 ? (1 - probabilidade) / (rotulos.length - 1) : 0;
  return Object.fromEntries(
    rotulos.map((rotulo) => [rotulo, arredondar(rotulo === escolhido ? probabilidade : resto)]),
  );
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : JSON.stringify(valor ?? '');
}

// Verificação de achados (fase 11): a referência é `claim` e o avaliado, a união dos trechos de `evidence`.
function textosDaPergunta(
  state: EntryType,
  instrucoes: unknown,
): { referencia: string; avaliado: string } {
  const objeto = typeof state === 'object' && state !== null && !Array.isArray(state) ? state : {};
  if (typeof objeto.claim === 'string') {
    const evidencias = Array.isArray(objeto.evidence) ? objeto.evidence : [];
    const trechos = evidencias.map((item) =>
      typeof item === 'object' && item !== null && 'text' in item ? textoDe(item.text) : '',
    );
    return { referencia: objeto.claim, avaliado: trechos.join(' ') };
  }
  return { referencia: textoDe(instrucoes), avaliado: textoDe(objeto.comment) };
}

function comentarioDo(state: EntryType): string {
  const objeto = typeof state === 'object' && state !== null && !Array.isArray(state) ? state : {};
  return textoDe(objeto.comment);
}

function responderPadrao(nome: string, analise: Analise, rotulos: string[]): unknown {
  switch (nome) {
    case 'topic':
      return {
        type: 'choice',
        choice: analise.tema,
        confidence: analise.confiancaDoTema,
        probabilities: distribuir(rotulos, analise.tema, analise.confiancaDoTema),
      };
    case 'sentiment':
      return {
        type: 'choice',
        choice: analise.sentimento,
        confidence: analise.confiancaDoSentimento,
        probabilities: distribuir(rotulos, analise.sentimento, analise.confiancaDoSentimento),
      };
    default:
      return undefined;
  }
}

function responderGravidade(analise: Analise, niveis: unknown[]): unknown {
  const indices = niveis.map((_nivel, indice) => String(indice));
  return {
    type: 'score',
    score: analise.gravidade,
    confidence: 0.75,
    legend: Object.fromEntries(niveis.map((nivel, indice) => [String(indice), nivel])),
    probabilities: distribuir(indices, String(analise.gravidade), 0.7),
  };
}

function responderUma(nome: string, pergunta: Questions[string], state: EntryType): unknown {
  const analise = analisar(comentarioDo(state));
  if (pergunta.type === 'choice') {
    const rotulos = Object.keys(pergunta.criteria);
    return (
      responderPadrao(nome, analise, rotulos) ?? {
        type: 'choice',
        choice: rotulos[0],
        confidence: 0.5,
        probabilities: distribuir(rotulos, rotulos[0] ?? '', 0.5),
      }
    );
  }
  if (pergunta.type === 'score') {
    return responderGravidade(analise, [...pergunta.criteria]);
  }
  if (nome === 'needs_action') {
    return { type: 'noul', noul: analise.probabilidadeDeAcao };
  }
  const { referencia, avaliado } = textosDaPergunta(state, pergunta.instructions);
  return { type: 'noul', noul: fracaoCoberta(referencia, avaliado) };
}

function estimarTokens(valor: unknown): number {
  return Math.ceil(JSON.stringify(valor).length / CARACTERES_POR_TOKEN_SIMULADO);
}

// Determinístico: a mesma entrada devolve sempre a mesma saída, sem rede e sem aleatoriedade.
export function criarClassificadorSimulado(): ClassificadorDeComentarios {
  const avaliar: ClassificadorDeComentarios['avaliar'] = <const Q extends Questions>(
    state: EntryType,
    perguntas: Q,
  ) => {
    const nomes = Object.keys(perguntas);
    const respostas = Object.fromEntries(
      Object.entries(perguntas).map(([nome, pergunta]) => [
        nome,
        responderUma(nome, pergunta, state),
      ]),
    );
    return Promise.resolve({
      modelo: MODELO_SIMULADO,
      respostas: respostas as SystemOneResult<Q>['answers'],
      uso: {
        tokensEntrada: estimarTokens({ state, perguntas }),
        tokensSaida: nomes.length * TOKENS_DE_SAIDA_POR_PERGUNTA,
      },
      tentativasAmbiguas: 0,
    });
  };
  return criarClassificador(avaliar);
}
