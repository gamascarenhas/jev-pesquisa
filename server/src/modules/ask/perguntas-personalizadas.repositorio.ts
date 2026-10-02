import type { Banco } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import type { ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';
import type { EntradaDosFiltros } from '../comments/comentarios.servico.js';
import type {
  CriteriosDoJev,
  InterpretacaoGravada,
  PerguntaGravada,
  StatusDaPergunta,
} from './perguntar.tipos.js';

interface LinhaDePergunta {
  id: string;
  texto_original: string;
  hash_pergunta: string;
  respondivel: boolean | null;
  instrucoes_jev: string | null;
  criterios_jev: CriteriosDoJev | null;
  interpretacao_pt: string | null;
  motivo_nao_respondivel: string | null;
  filtros: EntradaDosFiltros;
  total_alvo: number | null;
  status: StatusDaPergunta;
  criado_em: Date;
}

const COLUNAS = `id, texto_original, hash_pergunta, respondivel, instrucoes_jev, criterios_jev,
  interpretacao_pt, motivo_nao_respondivel, filtros, total_alvo, status, criado_em`;

function mapear(linha: LinhaDePergunta): PerguntaGravada {
  return {
    id: linha.id,
    textoOriginal: linha.texto_original,
    hashPergunta: linha.hash_pergunta,
    respondivel: linha.respondivel,
    instrucoes: linha.instrucoes_jev,
    criterios: linha.criterios_jev,
    interpretacao: linha.interpretacao_pt,
    motivoNaoRespondivel: linha.motivo_nao_respondivel,
    filtros: linha.filtros,
    totalAlvo: linha.total_alvo,
    status: linha.status,
    criadoEm: linha.criado_em,
  };
}

export interface NovaPergunta {
  textoOriginal: string;
  hashPergunta: string;
  filtros: EntradaDosFiltros;
}

export interface LinhaDeResposta {
  comentarioId: string;
  probabilidade: number;
  modelo: string;
}

const STATUS_INTERPRETADOS =
  "('awaiting_confirmation', 'not_answerable', 'running', 'paused_limit', 'done')";

export class PerguntasPersonalizadasRepositorio {
  constructor(private readonly banco: Banco) {}

  async criar(
    contaId: ContaId,
    projetoId: ProjetoId,
    usuarioId: UsuarioId,
    nova: NovaPergunta,
  ): Promise<PerguntaGravada> {
    const resultado = await this.banco.query<LinhaDePergunta>(
      `INSERT INTO perguntas_personalizadas (conta_id, projeto_id, criado_por, texto_original,
                                             hash_pergunta, filtros)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUNAS}`,
      [
        contaId,
        projetoId,
        usuarioId,
        nova.textoOriginal,
        nova.hashPergunta,
        JSON.stringify(nova.filtros),
      ],
    );
    return mapear(exigirPrimeiraLinha(resultado.rows));
  }

  async buscarPorId(
    contaId: ContaId,
    projetoId: ProjetoId,
    id: string,
  ): Promise<PerguntaGravada | undefined> {
    const resultado = await this.banco.query<LinhaDePergunta>(
      `SELECT ${COLUNAS} FROM perguntas_personalizadas
        WHERE conta_id = $1 AND projeto_id = $2 AND id = $3`,
      [contaId, projetoId, id],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  // A mesma pergunta com os mesmos filtros reabre a interpretação e o resultado, sem custo.
  async buscarIgual(
    contaId: ContaId,
    projetoId: ProjetoId,
    hash: string,
    filtros: EntradaDosFiltros,
  ): Promise<PerguntaGravada | undefined> {
    const resultado = await this.banco.query<LinhaDePergunta>(
      `SELECT ${COLUNAS} FROM perguntas_personalizadas
        WHERE conta_id = $1 AND projeto_id = $2 AND hash_pergunta = $3 AND filtros = $4::jsonb
          AND status IN ${STATUS_INTERPRETADOS}
        ORDER BY criado_em DESC LIMIT 1`,
      [contaId, projetoId, hash, JSON.stringify(filtros)],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  // Com outros filtros, a interpretação em si continua valendo e o LLM não é chamado de novo.
  async buscarInterpretacao(
    contaId: ContaId,
    projetoId: ProjetoId,
    hash: string,
  ): Promise<PerguntaGravada | undefined> {
    const resultado = await this.banco.query<LinhaDePergunta>(
      `SELECT ${COLUNAS} FROM perguntas_personalizadas
        WHERE conta_id = $1 AND projeto_id = $2 AND hash_pergunta = $3
          AND respondivel IS NOT NULL AND status IN ${STATUS_INTERPRETADOS}
        ORDER BY criado_em DESC LIMIT 1`,
      [contaId, projetoId, hash],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  async gravarInterpretacao(
    contaId: ContaId,
    id: string,
    interpretacao: InterpretacaoGravada,
    totalAlvo: number | null,
  ): Promise<PerguntaGravada> {
    const resultado = await this.banco.query<LinhaDePergunta>(
      `UPDATE perguntas_personalizadas
          SET respondivel = $3, instrucoes_jev = $4, criterios_jev = $5, interpretacao_pt = $6,
              motivo_nao_respondivel = $7, total_alvo = $8, atualizado_em = now(),
              status = CASE WHEN $3 THEN 'awaiting_confirmation' ELSE 'not_answerable' END
        WHERE conta_id = $1 AND id = $2 RETURNING ${COLUNAS}`,
      [
        contaId,
        id,
        interpretacao.respondivel,
        interpretacao.instrucoes,
        interpretacao.criterios === null ? null : JSON.stringify(interpretacao.criterios),
        interpretacao.interpretacao,
        interpretacao.motivoNaoRespondivel,
        totalAlvo,
      ],
    );
    return mapear(exigirPrimeiraLinha(resultado.rows));
  }

  async atualizarStatus(
    contaId: ContaId,
    id: string,
    status: StatusDaPergunta,
    totalAlvo?: number,
  ): Promise<void> {
    await this.banco.query(
      `UPDATE perguntas_personalizadas
          SET status = $3, total_alvo = COALESCE($4, total_alvo), atualizado_em = now()
        WHERE conta_id = $1 AND id = $2`,
      [contaId, id, status, totalAlvo ?? null],
    );
  }

  async listarRecentes(
    contaId: ContaId,
    projetoId: ProjetoId,
    limite: number,
  ): Promise<PerguntaGravada[]> {
    const resultado = await this.banco.query<LinhaDePergunta>(
      `SELECT ${COLUNAS} FROM perguntas_personalizadas
        WHERE conta_id = $1 AND projeto_id = $2 AND status <> 'interpreting'
        ORDER BY criado_em DESC LIMIT $3`,
      [contaId, projetoId, limite],
    );
    return resultado.rows.map(mapear);
  }

  async idsRespondidos(contaId: ContaId, perguntaId: string): Promise<Set<string>> {
    const resultado = await this.banco.query<{ comentario_id: string }>(
      `SELECT comentario_id FROM respostas_perguntas_personalizadas
        WHERE conta_id = $1 AND pergunta_personalizada_id = $2`,
      [contaId, perguntaId],
    );
    return new Set(resultado.rows.map((l) => l.comentario_id));
  }

  async gravarRespostas(
    contaId: ContaId,
    perguntaId: string,
    respostas: LinhaDeResposta[],
  ): Promise<void> {
    if (respostas.length === 0) {
      return;
    }
    await this.banco.query(
      `INSERT INTO respostas_perguntas_personalizadas
         (pergunta_personalizada_id, comentario_id, conta_id, probabilidade, modelo)
       SELECT $1, t.comentario, $2, t.probabilidade, t.modelo
         FROM unnest($3::uuid[], $4::numeric[], $5::text[]) AS t(comentario, probabilidade, modelo)
       ON CONFLICT DO NOTHING`,
      [
        perguntaId,
        contaId,
        respostas.map((r) => r.comentarioId),
        respostas.map((r) => r.probabilidade),
        respostas.map((r) => r.modelo),
      ],
    );
  }

  // Resposta já gravada para a mesma pergunta e as mesmas instruções vale para qualquer pergunta igual do projeto.
  async copiarReaproveitaveis(
    contaId: ContaId,
    projetoId: ProjetoId,
    pergunta: PerguntaGravada,
    ids: string[],
  ): Promise<number> {
    const resultado = await this.banco.query(
      `INSERT INTO respostas_perguntas_personalizadas
         (pergunta_personalizada_id, comentario_id, conta_id, probabilidade, modelo)
       SELECT DISTINCT ON (r.comentario_id) $3, r.comentario_id, r.conta_id, r.probabilidade, r.modelo
         FROM respostas_perguntas_personalizadas r
         JOIN perguntas_personalizadas q
           ON q.id = r.pergunta_personalizada_id AND q.conta_id = r.conta_id
        WHERE q.conta_id = $1 AND q.projeto_id = $2 AND q.id <> $3
          AND q.hash_pergunta = $4 AND q.instrucoes_jev = $5
          AND r.comentario_id = ANY($6::uuid[])
        ORDER BY r.comentario_id, r.criado_em DESC
       ON CONFLICT DO NOTHING`,
      [contaId, projetoId, pergunta.id, pergunta.hashPergunta, pergunta.instrucoes, ids],
    );
    return resultado.rowCount ?? 0;
  }

  async contarReaproveitaveis(
    contaId: ContaId,
    projetoId: ProjetoId,
    pergunta: PerguntaGravada,
    ids: string[],
  ): Promise<number> {
    const resultado = await this.banco.query<{ total: string }>(
      `SELECT count(DISTINCT r.comentario_id) AS total
         FROM respostas_perguntas_personalizadas r
         JOIN perguntas_personalizadas q
           ON q.id = r.pergunta_personalizada_id AND q.conta_id = r.conta_id
        WHERE q.conta_id = $1 AND q.projeto_id = $2
          AND q.hash_pergunta = $3 AND q.instrucoes_jev = $4
          AND r.comentario_id = ANY($5::uuid[])`,
      [contaId, projetoId, pergunta.hashPergunta, pergunta.instrucoes, ids],
    );
    return Number(resultado.rows[0]?.total ?? 0);
  }
}

export function criarPerguntasPersonalizadasRepositorio(
  banco: Banco,
): PerguntasPersonalizadasRepositorio {
  return new PerguntasPersonalizadasRepositorio(banco);
}
