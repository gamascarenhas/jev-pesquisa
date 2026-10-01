import type { Banco } from '../../db/conexoes.js';
import { ehViolacaoDeChaveEstrangeira } from '../../db/erros-banco.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import { ErroDeValidacao, ErroNaoEncontrado } from '../../shared/errors.js';
import type { ComentarioId, ContaId, UsuarioId } from '../../shared/ids.js';
import { SENTIMENTOS, TEMAS } from './questions.js';

export interface Revisao {
  comentarioId: string;
  tema: string;
  sentimento: string;
  revisadoPor: string | null;
  revisadoEm: Date;
}

interface LinhaDeRevisao {
  comentario_id: string;
  tema: string;
  sentimento: string;
  revisado_por: string | null;
  revisado_em: Date;
}

function comentarioNaoEncontrado(): ErroNaoEncontrado {
  return new ErroNaoEncontrado('Comentário não encontrado.', 'comentario_nao_encontrado');
}

function mapear(linha: LinhaDeRevisao): Revisao {
  return {
    comentarioId: linha.comentario_id,
    tema: linha.tema,
    sentimento: linha.sentimento,
    revisadoPor: linha.revisado_por,
    revisadoEm: linha.revisado_em,
  };
}

export class RevisoesRepositorio {
  constructor(private readonly banco: Banco) {}

  // Os tópicos não têm restrição no banco: a lista vive em questions.ts e é conferida aqui.
  async gravar(
    contaId: ContaId,
    comentarioId: ComentarioId,
    tema: string,
    sentimento: string,
    usuarioId: UsuarioId,
  ): Promise<Revisao> {
    if (!(TEMAS as string[]).includes(tema) || !(SENTIMENTOS as string[]).includes(sentimento)) {
      throw new ErroDeValidacao('Tema ou sentimento inválido.', 'classificacao_invalida');
    }
    try {
      const resultado = await this.banco.query<LinhaDeRevisao>(
        `INSERT INTO revisoes_classificacao (comentario_id, conta_id, tema, sentimento, revisado_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (comentario_id) DO UPDATE SET
           tema = EXCLUDED.tema, sentimento = EXCLUDED.sentimento,
           revisado_por = EXCLUDED.revisado_por, revisado_em = now()
         WHERE revisoes_classificacao.conta_id = EXCLUDED.conta_id
         RETURNING comentario_id, tema, sentimento, revisado_por, revisado_em`,
        [comentarioId, contaId, tema, sentimento, usuarioId],
      );
      // Sem linha devolvida, o comentário já tem revisão de outra conta: nunca se sobrescreve.
      if (resultado.rows.length === 0) {
        throw comentarioNaoEncontrado();
      }
      return mapear(exigirPrimeiraLinha(resultado.rows));
    } catch (erro) {
      if (ehViolacaoDeChaveEstrangeira(erro)) {
        throw comentarioNaoEncontrado();
      }
      throw erro;
    }
  }

  async buscar(contaId: ContaId, comentarioId: ComentarioId): Promise<Revisao | undefined> {
    const resultado = await this.banco.query<LinhaDeRevisao>(
      `SELECT comentario_id, tema, sentimento, revisado_por, revisado_em
         FROM revisoes_classificacao WHERE conta_id = $1 AND comentario_id = $2`,
      [contaId, comentarioId],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }
}

export function criarRevisoesRepositorio(banco: Banco): RevisoesRepositorio {
  return new RevisoesRepositorio(banco);
}
