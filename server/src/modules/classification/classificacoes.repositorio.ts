import type { Banco, Executor } from '../../db/conexoes.js';
import { comTransacao } from '../../db/transacao.js';
import {
  comoComentarioId,
  type ComentarioId,
  type ContaId,
  type ProjetoId,
} from '../../shared/ids.js';
import type { ClassificacaoPronta, ComentarioParaClassificar } from './pos-processamento.js';

export type StatusDoComentario = 'pending' | 'done' | 'failed';

export interface ResumoDaClassificacao {
  pendentes: number;
  classificados: number;
  falhos: number;
  semTexto: number;
}

interface LinhaDePendente {
  id: string;
  texto_mascarado: string;
  nota: number | null;
  nome_unidade: string | null;
}

interface LinhaDeContagem {
  status_classificacao: string;
  total: string;
}

const STATUS_DO_RESUMO: Record<string, keyof ResumoDaClassificacao> = {
  pending: 'pendentes',
  done: 'classificados',
  failed: 'falhos',
  no_text: 'semTexto',
};

async function inserirClassificacao(
  cliente: Executor,
  contaId: ContaId,
  comentarioId: ComentarioId,
  classificacao: ClassificacaoPronta,
): Promise<void> {
  await cliente.query(
    `INSERT INTO classificacoes
       (comentario_id, conta_id, modelo, tema, tema_confianca, tema_probabilidades, sentimento,
        sentimento_confianca, sentimento_probabilidades, gravidade_pontuacao,
        gravidade_normalizada, gravidade_confianca, gravidade_probabilidades, precisa_acao,
        precisa_revisao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (comentario_id) DO UPDATE SET
       modelo = EXCLUDED.modelo, tema = EXCLUDED.tema, tema_confianca = EXCLUDED.tema_confianca,
       tema_probabilidades = EXCLUDED.tema_probabilidades, sentimento = EXCLUDED.sentimento,
       sentimento_confianca = EXCLUDED.sentimento_confianca,
       sentimento_probabilidades = EXCLUDED.sentimento_probabilidades,
       gravidade_pontuacao = EXCLUDED.gravidade_pontuacao,
       gravidade_normalizada = EXCLUDED.gravidade_normalizada,
       gravidade_confianca = EXCLUDED.gravidade_confianca,
       gravidade_probabilidades = EXCLUDED.gravidade_probabilidades,
       precisa_acao = EXCLUDED.precisa_acao, precisa_revisao = EXCLUDED.precisa_revisao,
       criado_em = now()
     WHERE classificacoes.conta_id = EXCLUDED.conta_id`,
    [
      comentarioId,
      contaId,
      classificacao.modelo,
      classificacao.tema,
      classificacao.temaConfianca,
      JSON.stringify(classificacao.temaProbabilidades),
      classificacao.sentimento,
      classificacao.sentimentoConfianca,
      JSON.stringify(classificacao.sentimentoProbabilidades),
      classificacao.gravidadePontuacao,
      classificacao.gravidadeNormalizada,
      classificacao.gravidadeConfianca,
      JSON.stringify(classificacao.gravidadeProbabilidades),
      classificacao.precisaAcao,
      classificacao.precisaRevisao,
    ],
  );
}

export class ClassificacoesRepositorio {
  constructor(private readonly banco: Banco) {}

  async proximosPendentes(
    contaId: ContaId,
    projetoId: ProjetoId,
    limite: number,
  ): Promise<ComentarioParaClassificar[]> {
    const resultado = await this.banco.query<LinhaDePendente>(
      `SELECT id, texto_mascarado, nota, nome_unidade FROM comentarios
        WHERE conta_id = $1 AND projeto_id = $2 AND status_classificacao = 'pending'
          AND texto_mascarado IS NOT NULL
        ORDER BY criado_em, id LIMIT $3`,
      [contaId, projetoId, limite],
    );
    return resultado.rows.map((linha) => ({
      id: comoComentarioId(linha.id),
      textoMascarado: linha.texto_mascarado,
      nota: linha.nota,
      unidade: linha.nome_unidade,
    }));
  }

  async tamanhosDosPendentes(
    contaId: ContaId,
    projetoId: ProjetoId,
    tamanhoMaximo: number,
  ): Promise<number[]> {
    const resultado = await this.banco.query<{ tamanho: number }>(
      `SELECT LEAST(length(texto_mascarado), $3) AS tamanho FROM comentarios
        WHERE conta_id = $1 AND projeto_id = $2 AND status_classificacao = 'pending'
          AND texto_mascarado IS NOT NULL`,
      [contaId, projetoId, tamanhoMaximo],
    );
    return resultado.rows.map((linha) => linha.tamanho);
  }

  async resumo(contaId: ContaId, projetoId: ProjetoId): Promise<ResumoDaClassificacao> {
    const resultado = await this.banco.query<LinhaDeContagem>(
      `SELECT status_classificacao, count(*) AS total FROM comentarios
        WHERE conta_id = $1 AND projeto_id = $2 GROUP BY status_classificacao`,
      [contaId, projetoId],
    );
    const resumo: ResumoDaClassificacao = {
      pendentes: 0,
      classificados: 0,
      falhos: 0,
      semTexto: 0,
    };
    for (const linha of resultado.rows) {
      const campo = STATUS_DO_RESUMO[linha.status_classificacao];
      if (campo !== undefined) {
        resumo[campo] = Number(linha.total);
      }
    }
    return resumo;
  }

  async gravar(
    contaId: ContaId,
    comentarioId: ComentarioId,
    classificacao: ClassificacaoPronta,
    truncado: boolean,
  ): Promise<boolean> {
    return comTransacao(this.banco, async (cliente) => {
      const atualizado = await cliente.query(
        `UPDATE comentarios
            SET status_classificacao = 'done', erro_classificacao = NULL,
                foi_truncado = $3, atualizado_em = now()
          WHERE conta_id = $1 AND id = $2 AND status_classificacao = 'pending'`,
        [contaId, comentarioId, truncado],
      );
      if (atualizado.rowCount !== 1) {
        return false;
      }
      await inserirClassificacao(cliente, contaId, comentarioId, classificacao);
      return true;
    });
  }

  // O erro guarda só o nome da falha, nunca texto de comentário; esgotadas as tentativas, o comentário falha.
  async registrarFalha(
    contaId: ContaId,
    comentarioId: ComentarioId,
    erro: string,
    maximoDeTentativas: number,
  ): Promise<StatusDoComentario | undefined> {
    const resultado = await this.banco.query<{ status_classificacao: StatusDoComentario }>(
      `UPDATE comentarios
          SET tentativas_classificacao = tentativas_classificacao + 1, erro_classificacao = $3,
              status_classificacao = CASE WHEN tentativas_classificacao + 1 >= $4
                                          THEN 'failed' ELSE 'pending' END,
              atualizado_em = now()
        WHERE conta_id = $1 AND id = $2 AND status_classificacao = 'pending'
        RETURNING status_classificacao`,
      [contaId, comentarioId, erro, maximoDeTentativas],
    );
    return resultado.rows[0]?.status_classificacao;
  }

  // O erro anterior fica até haver um novo resultado.
  async reprocessarFalhas(contaId: ContaId, projetoId: ProjetoId): Promise<number> {
    const resultado = await this.banco.query(
      `UPDATE comentarios SET status_classificacao = 'pending', tentativas_classificacao = 0,
              atualizado_em = now()
        WHERE conta_id = $1 AND projeto_id = $2 AND status_classificacao = 'failed'`,
      [contaId, projetoId],
    );
    return resultado.rowCount ?? 0;
  }
}

export function criarClassificacoesRepositorio(banco: Banco): ClassificacoesRepositorio {
  return new ClassificacoesRepositorio(banco);
}
