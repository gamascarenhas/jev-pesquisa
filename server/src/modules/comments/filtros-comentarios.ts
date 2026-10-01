import { z } from 'zod';

import { LIMIAR_PRECISA_ACAO } from '../../shared/thresholds.js';

const TAMANHO_MAXIMO_DO_ROTULO = 200;
const DESLOCAMENTO_DE_BRASILIA = '-03:00';
const MS_POR_DIA = 86_400_000;

const dataDoFiltro = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const esquemaFiltrosDeComentarios = z
  .object({
    fonteId: z.uuid().optional(),
    unidade: z.string().min(1).max(TAMANHO_MAXIMO_DO_ROTULO).optional(),
    tema: z.string().min(1).max(40).optional(),
    sentimento: z.string().min(1).max(40).optional(),
    de: dataDoFiltro.optional(),
    ate: dataDoFiltro.optional(),
    precisaAcao: z.enum(['true']).optional(),
  })
  .strict();

export type EntradaDosFiltros = z.infer<typeof esquemaFiltrosDeComentarios>;

export interface FiltrosDeComentarios {
  fonteId?: string | undefined;
  unidade?: string | undefined;
  tema?: string | undefined;
  sentimento?: string | undefined;
  /** Início do dia em Brasília. */
  de?: Date | undefined;
  /** Início do dia seguinte ao último dia pedido, exclusivo. */
  ateExclusivo?: Date | undefined;
  precisaAcao?: boolean | undefined;
}

export interface ClausulaSql {
  sql: string;
  parametros: unknown[];
}

export const CLAUSULA_BASE = `FROM comentarios c
  JOIN fontes f ON f.id = c.fonte_id AND f.conta_id = c.conta_id
  LEFT JOIN classificacoes cl ON cl.comentario_id = c.id AND cl.conta_id = c.conta_id
  LEFT JOIN revisoes_classificacao r ON r.comentario_id = c.id AND r.conta_id = c.conta_id`;

// A correção humana prevalece sobre a resposta do modelo, que continua gravada em classificacoes.
export const TEMA_EFETIVO = 'COALESCE(r.tema, cl.tema)';
export const SENTIMENTO_EFETIVO = 'COALESCE(r.sentimento, cl.sentimento)';
export const PENDENTE_DE_REVISAO = 'cl.precisa_revisao AND r.comentario_id IS NULL';

export function converterFiltros(entrada: EntradaDosFiltros): FiltrosDeComentarios {
  const ultimoDia =
    entrada.ate === undefined
      ? undefined
      : new Date(`${entrada.ate}T00:00:00${DESLOCAMENTO_DE_BRASILIA}`);
  return {
    fonteId: entrada.fonteId,
    unidade: entrada.unidade,
    tema: entrada.tema,
    sentimento: entrada.sentimento,
    de:
      entrada.de === undefined
        ? undefined
        : new Date(`${entrada.de}T00:00:00${DESLOCAMENTO_DE_BRASILIA}`),
    ateExclusivo: ultimoDia && new Date(ultimoDia.getTime() + MS_POR_DIA),
    precisaAcao: entrada.precisaAcao === 'true' ? true : undefined,
  };
}

// Toda condição vira parâmetro posicional: nenhum valor do usuário entra no texto do SQL.
// Comentário sem data fica fora do período, mas aparece com o filtro vazio.
export function traduzirFiltros(
  contaId: string,
  projetoId: string,
  filtros: FiltrosDeComentarios,
  adicionais: string[] = [],
): ClausulaSql {
  const parametros: unknown[] = [contaId, projetoId];
  const condicoes = ['c.conta_id = $1', 'c.projeto_id = $2', ...adicionais];
  const adicionar = (condicao: (posicao: string) => string, valor: unknown): void => {
    parametros.push(valor);
    condicoes.push(condicao(`$${String(parametros.length)}`));
  };
  if (filtros.fonteId !== undefined) {
    adicionar((p) => `c.fonte_id = ${p}`, filtros.fonteId);
  }
  if (filtros.unidade !== undefined) {
    adicionar((p) => `c.nome_unidade = ${p}`, filtros.unidade);
  }
  if (filtros.tema !== undefined) {
    adicionar((p) => `${TEMA_EFETIVO} = ${p}`, filtros.tema);
  }
  if (filtros.sentimento !== undefined) {
    adicionar((p) => `${SENTIMENTO_EFETIVO} = ${p}`, filtros.sentimento);
  }
  if (filtros.de !== undefined) {
    adicionar((p) => `c.comentado_em >= ${p}`, filtros.de);
  }
  if (filtros.ateExclusivo !== undefined) {
    adicionar((p) => `c.comentado_em < ${p}`, filtros.ateExclusivo);
  }
  if (filtros.precisaAcao === true) {
    adicionar((p) => `cl.precisa_acao >= ${p}`, LIMIAR_PRECISA_ACAO);
  }
  return { sql: `WHERE ${condicoes.join(' AND ')}`, parametros };
}
