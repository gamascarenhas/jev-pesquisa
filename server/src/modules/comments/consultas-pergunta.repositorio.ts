import type { Banco } from '../../db/conexoes.js';
import type { ContaId, ProjetoId } from '../../shared/ids.js';
import { calcularDeslocamento, type EntradaPaginacao } from '../../shared/pagination.js';
import type {
  AlvoDaPergunta,
  ContagemPorFaixa,
  FaixaDaPergunta,
  LimiaresDeFaixa,
  RespostaListada,
  TextoParaPergunta,
} from './comentarios.tipos.js';
import {
  COLUNAS_DA_LISTA,
  mapear,
  type LinhaListada,
} from './consultas-comentarios.repositorio.js';
import {
  CLAUSULA_BASE,
  traduzirFiltros,
  type FiltrosDeComentarios,
} from './filtros-comentarios.js';

const TABELA_DE_RESPOSTAS = 'respostas_perguntas_personalizadas';

interface ClausulaDeResposta {
  sql: string;
  parametros: unknown[];
  juncao: string;
}

// Junta as respostas da pergunta aos comentários; os filtros da tabela continuam valendo.
function clausulaDeResposta(
  contaId: ContaId,
  projetoId: ProjetoId,
  perguntaId: string,
  filtros: FiltrosDeComentarios,
): ClausulaDeResposta {
  const { sql, parametros } = traduzirFiltros(contaId, projetoId, filtros);
  parametros.push(perguntaId);
  const juncao = `JOIN ${TABELA_DE_RESPOSTAS} rp ON rp.comentario_id = c.id AND rp.conta_id = c.conta_id
    AND rp.pergunta_personalizada_id = $${String(parametros.length)}`;
  return { sql, parametros, juncao };
}

// Só entra na consulta o limiar que a faixa usa: o PostgreSQL recusa parâmetro sem uso.
function condicaoDaFaixa(
  faixa: FaixaDaPergunta,
  limiares: LimiaresDeFaixa,
  parametros: unknown[],
): string {
  const posicao = (valor: number): string => {
    parametros.push(valor);
    return `$${String(parametros.length)}`;
  };
  if (faixa === 'yes') {
    return `rp.probabilidade >= ${posicao(limiares.provavelmenteSim)}`;
  }
  if (faixa === 'no') {
    return `rp.probabilidade < ${posicao(limiares.provavelmenteNao)}`;
  }
  const sim = posicao(limiares.provavelmenteSim);
  return `rp.probabilidade >= ${posicao(limiares.provavelmenteNao)} AND rp.probabilidade < ${sim}`;
}

export class ConsultasPerguntaRepositorio {
  constructor(private readonly banco: Banco) {}

  // Só comentários com texto, do mais recente para o mais antigo, no limite pedido.
  async alvos(
    contaId: ContaId,
    projetoId: ProjetoId,
    filtros: FiltrosDeComentarios,
    limite: number,
    tamanhoMaximoDoTexto: number,
  ): Promise<{ total: number; alvos: AlvoDaPergunta[] }> {
    const { sql, parametros } = traduzirFiltros(contaId, projetoId, filtros, [
      'c.texto_mascarado IS NOT NULL',
    ]);
    const total = await this.banco.query<{ total: string }>(
      `SELECT count(*) AS total ${CLAUSULA_BASE} ${sql}`,
      parametros,
    );
    const lista = await this.banco.query<{ id: string; tamanho: number }>(
      `SELECT c.id, LEAST(length(c.texto_mascarado), $${String(parametros.length + 1)}) AS tamanho
         ${CLAUSULA_BASE} ${sql}
        ORDER BY c.comentado_em DESC NULLS LAST, c.id LIMIT $${String(parametros.length + 2)}`,
      [...parametros, tamanhoMaximoDoTexto, limite],
    );
    return { total: Number(total.rows[0]?.total ?? 0), alvos: lista.rows };
  }

  async textos(
    contaId: ContaId,
    projetoId: ProjetoId,
    ids: string[],
  ): Promise<TextoParaPergunta[]> {
    const resultado = await this.banco.query<{
      id: string;
      texto: string;
      nota: number | null;
      unidade: string | null;
    }>(
      `SELECT id, texto_mascarado AS texto, nota, nome_unidade AS unidade FROM comentarios
        WHERE conta_id = $1 AND projeto_id = $2 AND id = ANY($3::uuid[])
          AND texto_mascarado IS NOT NULL`,
      [contaId, projetoId, ids],
    );
    return resultado.rows.map((l) => ({
      id: l.id,
      textoMascarado: l.texto,
      nota: l.nota,
      unidade: l.unidade,
    }));
  }

  async contarPorFaixa(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    limiares: LimiaresDeFaixa,
  ): Promise<ContagemPorFaixa> {
    const { sql, parametros, juncao } = clausulaDeResposta(contaId, projetoId, perguntaId, filtros);
    parametros.push(limiares.provavelmenteSim, limiares.provavelmenteNao);
    const sim = `$${String(parametros.length - 1)}`;
    const nao = `$${String(parametros.length)}`;
    const resultado = await this.banco.query<{ sim: string; incerto: string; nao: string }>(
      `SELECT count(*) FILTER (WHERE rp.probabilidade >= ${sim}) AS sim,
              count(*) FILTER (WHERE rp.probabilidade >= ${nao} AND rp.probabilidade < ${sim}) AS incerto,
              count(*) FILTER (WHERE rp.probabilidade < ${nao}) AS nao
         ${CLAUSULA_BASE} ${juncao} ${sql}`,
      parametros,
    );
    const linha = resultado.rows[0];
    return {
      sim: Number(linha?.sim ?? 0),
      incerto: Number(linha?.incerto ?? 0),
      nao: Number(linha?.nao ?? 0),
    };
  }

  async listarRespostas(
    contaId: ContaId,
    projetoId: ProjetoId,
    perguntaId: string,
    filtros: FiltrosDeComentarios,
    faixa: FaixaDaPergunta,
    limiares: LimiaresDeFaixa,
    paginacao: EntradaPaginacao,
  ): Promise<{ itens: RespostaListada[]; total: number }> {
    const { sql, parametros, juncao } = clausulaDeResposta(contaId, projetoId, perguntaId, filtros);
    const onde = `${sql} AND ${condicaoDaFaixa(faixa, limiares, parametros)}`;
    const total = await this.banco.query<{ total: string }>(
      `SELECT count(*) AS total ${CLAUSULA_BASE} ${juncao} ${onde}`,
      parametros,
    );
    const linhas = await this.banco.query<LinhaListada & { probabilidade: string }>(
      `SELECT ${COLUNAS_DA_LISTA}, rp.probabilidade::text AS probabilidade
         ${CLAUSULA_BASE} ${juncao} ${onde}
        ORDER BY rp.probabilidade DESC, c.id
        LIMIT $${String(parametros.length + 1)} OFFSET $${String(parametros.length + 2)}`,
      [...parametros, paginacao.tamanhoPagina, calcularDeslocamento(paginacao)],
    );
    return {
      itens: linhas.rows.map((l) => ({ ...mapear(l), probabilidade: Number(l.probabilidade) })),
      total: Number(total.rows[0]?.total ?? 0),
    };
  }
}

export function criarConsultasPerguntaRepositorio(banco: Banco): ConsultasPerguntaRepositorio {
  return new ConsultasPerguntaRepositorio(banco);
}
