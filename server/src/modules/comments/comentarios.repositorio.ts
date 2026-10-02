import type { Banco, Executor } from '../../db/conexoes.js';
import type { ContaId, FonteId, ProjetoId } from '../../shared/ids.js';

export interface LinhaParaInserir {
  textoOriginal: string;
  textoMascarado: string;
  nota: number | null;
  unidade: string | null;
  autor: string | null;
  comentadoEm: Date | null;
  hashConteudo: string;
}

export interface LinhaExterna {
  idExterno: string;
  textoOriginal: string | null;
  textoMascarado: string | null;
  nota: number | null;
  unidade: string | null;
  autor: string | null;
  comentadoEm: Date | null;
  atualizadoEm: Date;
  hashConteudo: string;
}

const SQL_DE_SINCRONIZACAO = `
WITH entrada AS (
  SELECT * FROM unnest($4::text[], $5::text[], $6::text[], $7::smallint[], $8::text[], $9::text[],
                       $10::timestamptz[], $11::timestamptz[], $12::text[])
       AS t(id_externo, original, mascarado, nota, unidade, autor, comentado_em, atualizado_em, hash)
),
alterados AS (
  UPDATE comentarios c
     SET texto_original = e.original, texto_mascarado = e.mascarado, nota = e.nota,
         nome_unidade = e.unidade, nome_autor = e.autor, comentado_em = e.comentado_em,
         fonte_atualizada_em = e.atualizado_em, foi_truncado = false,
         status_classificacao = CASE WHEN e.original IS NULL THEN 'no_text' ELSE 'pending' END,
         tentativas_classificacao = 0, erro_classificacao = NULL, atualizado_em = now()
    FROM entrada e
   WHERE c.conta_id = $1 AND c.fonte_id = $3 AND c.id_externo = e.id_externo
     AND (c.fonte_atualizada_em IS NULL OR c.fonte_atualizada_em < e.atualizado_em)
  RETURNING c.id
),
classificacoes_apagadas AS (
  DELETE FROM classificacoes WHERE conta_id = $1 AND comentario_id IN (SELECT id FROM alterados)
),
revisoes_apagadas AS (
  DELETE FROM revisoes_classificacao
   WHERE conta_id = $1 AND comentario_id IN (SELECT id FROM alterados)
),
respostas_apagadas AS (
  DELETE FROM respostas_perguntas_personalizadas
   WHERE conta_id = $1 AND comentario_id IN (SELECT id FROM alterados)
),
novos AS (
  INSERT INTO comentarios (conta_id, projeto_id, fonte_id, id_externo, texto_original,
                           texto_mascarado, nota, nome_unidade, nome_autor, comentado_em,
                           fonte_atualizada_em, hash_conteudo, status_classificacao)
  SELECT $1, $2, $3, e.id_externo, e.original, e.mascarado, e.nota, e.unidade, e.autor,
         e.comentado_em, e.atualizado_em, e.hash,
         CASE WHEN e.original IS NULL THEN 'no_text' ELSE 'pending' END
    FROM entrada e
   WHERE NOT EXISTS (SELECT 1 FROM comentarios c WHERE c.fonte_id = $3 AND c.id_externo = e.id_externo)
  ON CONFLICT DO NOTHING
  RETURNING (texto_original IS NULL) AS sem_texto
)
SELECT (SELECT count(*) FROM novos) AS inseridos,
       (SELECT count(*) FROM novos WHERE sem_texto) AS sem_texto,
       (SELECT count(*) FROM alterados) AS atualizados`;

export class ComentariosRepositorio {
  constructor(private readonly banco: Banco) {}

  // Idempotente: o índice único (projeto, hash) descarta o que já existe, inclusive repetido no próprio lote.
  async inserirEmLote(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
    linhas: LinhaParaInserir[],
    executor: Executor = this.banco,
  ): Promise<number> {
    if (linhas.length === 0) {
      return 0;
    }
    const resultado = await executor.query(
      `INSERT INTO comentarios (conta_id, projeto_id, fonte_id, texto_original, texto_mascarado,
                                nota, nome_unidade, nome_autor, comentado_em, hash_conteudo)
       SELECT $1, $2, $3, t.original, t.mascarado, t.nota, t.unidade, t.autor, t.comentado_em, t.hash
         FROM unnest($4::text[], $5::text[], $6::smallint[], $7::text[], $8::text[],
                     $9::timestamptz[], $10::text[])
              AS t(original, mascarado, nota, unidade, autor, comentado_em, hash)
       ON CONFLICT DO NOTHING`,
      [
        contaId,
        projetoId,
        fonteId,
        linhas.map((linha) => linha.textoOriginal),
        linhas.map((linha) => linha.textoMascarado),
        linhas.map((linha) => linha.nota),
        linhas.map((linha) => linha.unidade),
        linhas.map((linha) => linha.autor),
        linhas.map((linha) => linha.comentadoEm?.toISOString() ?? null),
        linhas.map((linha) => linha.hashConteudo),
      ],
    );
    return resultado.rowCount ?? 0;
  }

  // Idempotente: a avaliação nova entra; a já conhecida só muda se o Google a atualizou depois.
  async sincronizarExternos(
    contaId: ContaId,
    projetoId: ProjetoId,
    fonteId: FonteId,
    linhas: LinhaExterna[],
    executor: Executor = this.banco,
  ): Promise<{ inseridos: number; atualizados: number; semTexto: number }> {
    if (linhas.length === 0) {
      return { inseridos: 0, atualizados: 0, semTexto: 0 };
    }
    const resultado = await executor.query<{
      inseridos: string;
      atualizados: string;
      sem_texto: string;
    }>(SQL_DE_SINCRONIZACAO, [
      contaId,
      projetoId,
      fonteId,
      linhas.map((linha) => linha.idExterno),
      linhas.map((linha) => linha.textoOriginal),
      linhas.map((linha) => linha.textoMascarado),
      linhas.map((linha) => linha.nota),
      linhas.map((linha) => linha.unidade),
      linhas.map((linha) => linha.autor),
      linhas.map((linha) => linha.comentadoEm?.toISOString() ?? null),
      linhas.map((linha) => linha.atualizadoEm.toISOString()),
      linhas.map((linha) => linha.hashConteudo),
    ]);
    const linha = resultado.rows[0];
    return {
      inseridos: Number(linha?.inseridos ?? 0),
      atualizados: Number(linha?.atualizados ?? 0),
      semTexto: Number(linha?.sem_texto ?? 0),
    };
  }
}

export function criarComentariosRepositorio(banco: Banco): ComentariosRepositorio {
  return new ComentariosRepositorio(banco);
}
