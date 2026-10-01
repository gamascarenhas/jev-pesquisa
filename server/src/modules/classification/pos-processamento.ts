import type { ComentarioId } from '../../shared/ids.js';
import type {
  EstadoDoComentario,
  RespostasDoComentario,
} from '../../integrations/jev/classificador-comentarios.js';
import { perguntasDoComentario } from './questions.js';

export const LIMIAR_CONFIANCA_REVISAO = 0.5;
export const MAX_CARACTERES_COMENTARIO = 4_000;
// Hoje 3: o índice do nível mais alto da pergunta de gravidade.
export const NIVEL_MAXIMO_DE_GRAVIDADE = perguntasDoComentario.severity.criteria.length - 1;

export interface ComentarioParaClassificar {
  id: ComentarioId;
  textoMascarado: string;
  nota: number | null;
  unidade: string | null;
}

export interface ClassificacaoPronta {
  modelo: string;
  tema: string;
  temaConfianca: number;
  temaProbabilidades: Record<string, number>;
  sentimento: string;
  sentimentoConfianca: number;
  sentimentoProbabilidades: Record<string, number>;
  gravidadePontuacao: number;
  gravidadeNormalizada: number;
  gravidadeConfianca: number;
  gravidadeProbabilidades: Record<string, number>;
  precisaAcao: number;
  precisaRevisao: boolean;
}

export function montarEstado(comentario: ComentarioParaClassificar): {
  estado: EstadoDoComentario;
  truncado: boolean;
} {
  const truncado = comentario.textoMascarado.length > MAX_CARACTERES_COMENTARIO;
  return {
    estado: {
      comment: truncado
        ? comentario.textoMascarado.slice(0, MAX_CARACTERES_COMENTARIO)
        : comentario.textoMascarado,
      rating: comentario.nota,
      location: comentario.unidade,
    },
    truncado,
  };
}

function entre0e1(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}

export function normalizarGravidade(pontuacao: number): number {
  return entre0e1(pontuacao / NIVEL_MAXIMO_DE_GRAVIDADE);
}

export function precisaDeRevisao(confiancaDoTema: number, confiancaDoSentimento: number): boolean {
  return (
    confiancaDoTema < LIMIAR_CONFIANCA_REVISAO || confiancaDoSentimento < LIMIAR_CONFIANCA_REVISAO
  );
}

export function posProcessar(resultado: RespostasDoComentario): ClassificacaoPronta {
  const { topic, sentiment, severity, needs_action: acao } = resultado.respostas;
  return {
    modelo: resultado.modelo,
    tema: topic.choice,
    temaConfianca: entre0e1(topic.confidence),
    temaProbabilidades: { ...topic.probabilities },
    sentimento: sentiment.choice,
    sentimentoConfianca: entre0e1(sentiment.confidence),
    sentimentoProbabilidades: { ...sentiment.probabilities },
    gravidadePontuacao: Math.max(0, severity.score),
    gravidadeNormalizada: normalizarGravidade(severity.score),
    gravidadeConfianca: entre0e1(severity.confidence),
    gravidadeProbabilidades: { ...severity.probabilities },
    precisaAcao: entre0e1(acao.noul),
    precisaRevisao: precisaDeRevisao(topic.confidence, sentiment.confidence),
  };
}
