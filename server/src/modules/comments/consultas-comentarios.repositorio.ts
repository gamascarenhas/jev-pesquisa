import type { Banco } from '../../db/conexoes.js';
import type { ContaId, ProjetoId } from '../../shared/ids.js';
import { calcularDeslocamento, type EntradaPaginacao } from '../../shared/pagination.js';
import type {
  ComentarioListado,
  ContagemDeGravidade,
  ContagemTemaSentimento,
  OpcoesDeFiltro,
  ResumoDoPainel,
} from './comentarios.tipos.js';
import {
  CLAUSULA_BASE,
  PENDENTE_DE_REVISAO,
  SENTIMENTO_EFETIVO,
  TEMA_EFETIVO,
  traduzirFiltros,
  type FiltrosDeComentarios,
} from './filtros-comentarios.js';

const LIMITE_DE_UNIDADES_NO_FILTRO = 200;

interface LinhaListada {
  id: string;
  texto_original: string | null;
  fonte: string;
  nome_unidade: string | null;
  nome_autor: string | null;
  comentado_em: Date | null;
  nota: number | null;
  tema: string | null;
  sentimento: string | null;
  tema_modelo: string | null;
  sentimento_modelo: string | null;
  tema_confianca: string | null;
  sentimento_confianca: string | null;
  gravidade: string | null;
  precisa_acao: string | null;
  precisa_revisao: boolean | null;
  revisado: boolean;
  status_classificacao: string;
}

const COLUNAS_DA_LISTA = `c.id, c.texto_original, f.nome AS fonte, c.nome_unidade, c.nome_autor,
  c.comentado_em, c.nota, ${TEMA_EFETIVO} AS tema, ${SENTIMENTO_EFETIVO} AS sentimento,
  cl.tema AS tema_modelo, cl.sentimento AS sentimento_modelo,
  cl.tema_confianca::text, cl.sentimento_confianca::text, cl.gravidade_normalizada::text AS gravidade,
  cl.precisa_acao::text, cl.precisa_revisao, (r.comentario_id IS NOT NULL) AS revisado,
  c.status_classificacao`;

function numeroOuNulo(valor: string | null): number | null {
  return valor === null ? null : Number(valor);
}

function mapear(linha: LinhaListada): ComentarioListado {
  return {
    id: linha.id,
    textoOriginal: linha.texto_original,
    fonte: linha.fonte,
    unidade: linha.nome_unidade,
    autor: linha.nome_autor,
    comentadoEm: linha.comentado_em,
    nota: linha.nota,
    tema: linha.tema,
    sentimento: linha.sentimento,
    temaDoModelo: linha.tema_modelo,
    sentimentoDoModelo: linha.sentimento_modelo,
    temaConfianca: numeroOuNulo(linha.tema_confianca),
    sentimentoConfianca: numeroOuNulo(linha.sentimento_confianca),
    gravidade: numeroOuNulo(linha.gravidade),
    precisaAcao: numeroOuNulo(linha.precisa_acao),
    precisaRevisao: linha.precisa_revisao ?? false,
    foiRevisado: linha.revisado,
    statusClassificacao: linha.status_classificacao,
  };
}

export class ConsultasComentariosRepositorio {
  constructor(private readonly banco: Banco) {}

  async resumo(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): Promise<ResumoDoPainel> {
    const { sql, parametros } = traduzirFiltros(contaId, projetoId, filtros);
    const resultado = await this.banco.query<{
      total: string;
      classificados: string;
      pendentes: string;
      nota_media: string | null;
    }>(
      `SELECT count(*) AS total, count(cl.comentario_id) AS classificados,
              count(*) FILTER (WHERE ${PENDENTE_DE_REVISAO}) AS pendentes,
              round(avg(c.nota), 2)::text AS nota_media
         ${CLAUSULA_BASE} ${sql}`,
      parametros,
    );
    const linha = resultado.rows[0];
    return {
      total: Number(linha?.total ?? 0),
      classificados: Number(linha?.classificados ?? 0),
      pendentesDeRevisao: Number(linha?.pendentes ?? 0),
      notaMedia: numeroOuNulo(linha?.nota_media ?? null),
    };
  }

  async porTemaESentimento(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
  ): Promise<ContagemTemaSentimento[]> {
    const { sql, parametros } = traduzirFiltros(contaId, projetoId, filtros, [
      'cl.comentario_id IS NOT NULL',
    ]);
    const resultado = await this.banco.query<{ tema: string; sentimento: string; total: string }>(
      `SELECT ${TEMA_EFETIVO} AS tema, ${SENTIMENTO_EFETIVO} AS sentimento, count(*) AS total
         ${CLAUSULA_BASE} ${sql} GROUP BY 1, 2 ORDER BY 3 DESC, 1, 2`,
      parametros,
    );
    return resultado.rows.map((l) => ({
      tema: l.tema,
      sentimento: l.sentimento,
      total: Number(l.total),
    }));
  }

  async porGravidade(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    nivelMaximo: number,
  ): Promise<ContagemDeGravidade[]> {
    const { sql, parametros } = traduzirFiltros(contaId, projetoId, filtros, [
      'cl.comentario_id IS NOT NULL',
    ]);
    parametros.push(nivelMaximo);
    const resultado = await this.banco.query<{ nivel: number; total: string }>(
      `SELECT LEAST(GREATEST(round(cl.gravidade_pontuacao)::int, 0), $${String(parametros.length)}) AS nivel,
              count(*) AS total
         ${CLAUSULA_BASE} ${sql} GROUP BY 1 ORDER BY 1`,
      parametros,
    );
    return resultado.rows.map((l) => ({ nivel: l.nivel, total: Number(l.total) }));
  }

  async opcoesDeFiltro(contaId: ContaId, projetoId: ProjetoId): Promise<OpcoesDeFiltro> {
    const [fontes, unidades] = await Promise.all([
      this.banco.query<{ id: string; nome: string }>(
        'SELECT id, nome FROM fontes WHERE conta_id = $1 AND projeto_id = $2 ORDER BY nome, id',
        [contaId, projetoId],
      ),
      this.banco.query<{ nome_unidade: string }>(
        `SELECT DISTINCT nome_unidade FROM comentarios
          WHERE conta_id = $1 AND projeto_id = $2 AND nome_unidade IS NOT NULL
          ORDER BY nome_unidade LIMIT $3`,
        [contaId, projetoId, LIMITE_DE_UNIDADES_NO_FILTRO],
      ),
    ]);
    return { fontes: fontes.rows, unidades: unidades.rows.map((l) => l.nome_unidade) };
  }

  async listar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    paginacao: EntradaPaginacao,
    somenteFilaDeRevisao: boolean,
  ): Promise<{ comentarios: ComentarioListado[]; total: number }> {
    const { sql, parametros } = traduzirFiltros(
      contaId,
      projetoId,
      filtros,
      somenteFilaDeRevisao ? [PENDENTE_DE_REVISAO] : [],
    );
    const proximo = parametros.length;
    const [itens, total] = await Promise.all([
      this.banco.query<LinhaListada>(
        `SELECT ${COLUNAS_DA_LISTA} ${CLAUSULA_BASE} ${sql}
          ORDER BY c.comentado_em DESC NULLS LAST, c.id
          LIMIT $${String(proximo + 1)} OFFSET $${String(proximo + 2)}`,
        [...parametros, paginacao.tamanhoPagina, calcularDeslocamento(paginacao)],
      ),
      this.banco.query<{ total: string }>(
        `SELECT count(*) AS total ${CLAUSULA_BASE} ${sql}`,
        parametros,
      ),
    ]);
    return { comentarios: itens.rows.map(mapear), total: Number(total.rows[0]?.total ?? 0) };
  }

  // Paginação por chave (id) para exportar sem OFFSET crescente.
  async lerLoteParaExportar(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    depoisDe: string | undefined,
    limite: number,
  ): Promise<ComentarioListado[]> {
    const { sql, parametros } = traduzirFiltros(contaId, projetoId, filtros);
    const proximo = parametros.length;
    const continuacao = depoisDe === undefined ? '' : `AND c.id > $${String(proximo + 2)}`;
    const resultado = await this.banco.query<LinhaListada>(
      `SELECT ${COLUNAS_DA_LISTA} ${CLAUSULA_BASE} ${sql} ${continuacao}
        ORDER BY c.id LIMIT $${String(proximo + 1)}`,
      depoisDe === undefined ? [...parametros, limite] : [...parametros, limite, depoisDe],
    );
    return resultado.rows.map(mapear);
  }

  async existeNoProjeto(
    contaId: ContaId,
    projetoId: ProjetoId,
    comentarioId: string,
  ): Promise<boolean> {
    const resultado = await this.banco.query(
      'SELECT 1 FROM comentarios WHERE conta_id = $1 AND projeto_id = $2 AND id = $3',
      [contaId, projetoId, comentarioId],
    );
    return resultado.rowCount === 1;
  }
}

export function criarConsultasComentariosRepositorio(
  banco: Banco,
): ConsultasComentariosRepositorio {
  return new ConsultasComentariosRepositorio(banco);
}
