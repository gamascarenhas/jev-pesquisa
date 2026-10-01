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
}

export function criarComentariosRepositorio(banco: Banco): ComentariosRepositorio {
  return new ComentariosRepositorio(banco);
}
