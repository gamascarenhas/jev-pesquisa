import { createHash } from 'node:crypto';

import type { Banco } from '../../db/conexoes.js';
import type { ContaId, ProjetoId } from '../../shared/ids.js';
import { LIMIAR_PRECISA_ACAO } from '../../shared/thresholds.js';
import type {
  AgregadoDoTema,
  CandidatoDoResumo,
  ComentarioCitado,
  FiltroDoResumo,
} from './comentarios.tipos.js';
import {
  CLAUSULA_BASE,
  SENTIMENTO_EFETIVO,
  traduzirFiltros,
  type ClausulaSql,
} from './filtros-comentarios.js';

const UNIDADES_PRINCIPAIS = 3;

function clausula(contaId: ContaId, projetoId: ProjetoId, filtro: FiltroDoResumo): ClausulaSql {
  return traduzirFiltros(
    contaId,
    projetoId,
    {
      tema: filtro.tema,
      unidade: filtro.unidade,
      de: filtro.de,
      ateExclusivo: filtro.ateExclusivo,
    },
    ['cl.comentario_id IS NOT NULL'],
  );
}

function numero(valor: string | null): number {
  return valor === null ? 0 : Number(valor);
}

// Consultas para o resumo executivo: sempre sobre comentários já classificados, com a correção humana valendo.
export class ConsultasResumoRepositorio {
  constructor(private readonly banco: Banco) {}

  async agregar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: FiltroDoResumo,
  ): Promise<AgregadoDoTema> {
    const { sql, parametros } = clausula(contaId, projetoId, filtro);
    const total = await this.banco.query<{
      volume: string;
      negativos: string;
      soma_gravidade: string | null;
      precisa_acao: string;
    }>(
      `SELECT count(*) AS volume,
              count(*) FILTER (WHERE ${SENTIMENTO_EFETIVO} = 'negative') AS negativos,
              sum(cl.gravidade_normalizada)::text AS soma_gravidade,
              count(*) FILTER (WHERE cl.precisa_acao >= ${String(LIMIAR_PRECISA_ACAO)}) AS precisa_acao
         ${CLAUSULA_BASE} ${sql}`,
      parametros,
    );
    const unidades = await this.banco.query<{ unidade: string; total: string }>(
      `SELECT c.nome_unidade AS unidade, count(*) AS total ${CLAUSULA_BASE}
        ${sql} AND c.nome_unidade IS NOT NULL
        GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${String(UNIDADES_PRINCIPAIS)}`,
      parametros,
    );
    const linha = total.rows[0];
    return {
      volume: numero(linha?.volume ?? null),
      negativos: numero(linha?.negativos ?? null),
      somaDaGravidade: numero(linha?.soma_gravidade ?? null),
      precisamDeAcao: numero(linha?.precisa_acao ?? null),
      unidadesPrincipais: unidades.rows.map((u) => ({
        unidade: u.unidade,
        total: Number(u.total),
      })),
    };
  }

  // Sem comentários datados não há dois períodos para comparar.
  async primeiraDataComentada(contaId: ContaId, projetoId: ProjetoId): Promise<Date | null> {
    const resultado = await this.banco.query<{ primeira: Date | null }>(
      `SELECT min(comentado_em) AS primeira FROM comentarios
        WHERE conta_id = $1 AND projeto_id = $2`,
      [contaId, projetoId],
    );
    return resultado.rows[0]?.primeira ?? null;
  }

  async candidatos(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: FiltroDoResumo,
  ): Promise<CandidatoDoResumo[]> {
    const { sql, parametros } = clausula(contaId, projetoId, filtro);
    const resultado = await this.banco.query<{
      id: string;
      texto: string;
      comentado_em: Date | null;
      unidade: string | null;
      gravidade: string;
      confianca: string;
    }>(
      `SELECT c.id, c.texto_mascarado AS texto, c.comentado_em, c.nome_unidade AS unidade,
              cl.gravidade_normalizada::text AS gravidade, cl.tema_confianca::text AS confianca
         ${CLAUSULA_BASE} ${sql} AND c.texto_mascarado IS NOT NULL
        ORDER BY c.id`,
      parametros,
    );
    return resultado.rows.map((l) => ({
      id: l.id,
      textoMascarado: l.texto,
      comentadoEm: l.comentado_em,
      unidade: l.unidade,
      gravidade: Number(l.gravidade),
      confiancaDoTema: Number(l.confianca),
    }));
  }

  // O que muda o resumo muda a impressão: comentários, classificações e correções do tema e período.
  async impressaoDigital(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtro: FiltroDoResumo,
  ): Promise<string> {
    const { sql, parametros } = clausula(contaId, projetoId, filtro);
    const resultado = await this.banco.query<{ impressao: string | null }>(
      `SELECT string_agg(c.id::text || ':' || ${SENTIMENTO_EFETIVO} || ':' ||
                         cl.gravidade_pontuacao::text || ':' || cl.precisa_acao::text || ':' ||
                         c.atualizado_em::text, ',' ORDER BY c.id) AS impressao
         ${CLAUSULA_BASE} ${sql}`,
      parametros,
    );
    return createHash('sha256')
      .update(resultado.rows[0]?.impressao ?? '')
      .digest('hex');
  }

  async citados(
    contaId: ContaId,
    projetoId: ProjetoId,
    ids: string[],
  ): Promise<ComentarioCitado[]> {
    if (ids.length === 0) {
      return [];
    }
    const resultado = await this.banco.query<{
      id: string;
      texto: string | null;
      nota: number | null;
      unidade: string | null;
      comentado_em: Date | null;
    }>(
      `SELECT id, texto_original AS texto, nota, nome_unidade AS unidade, comentado_em
         FROM comentarios WHERE conta_id = $1 AND projeto_id = $2 AND id = ANY($3::uuid[])`,
      [contaId, projetoId, ids],
    );
    const porId = new Map(resultado.rows.map((l) => [l.id, l]));
    return ids.flatMap((id) => {
      const linha = porId.get(id);
      return linha
        ? [
            {
              id,
              texto: linha.texto,
              nota: linha.nota,
              unidade: linha.unidade,
              comentadoEm: linha.comentado_em,
            },
          ]
        : [];
    });
  }
}

export function criarConsultasResumoRepositorio(banco: Banco): ConsultasResumoRepositorio {
  return new ConsultasResumoRepositorio(banco);
}
