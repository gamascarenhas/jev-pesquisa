import type { Banco, Executor } from '../../db/conexoes.js';
import { exigirPrimeiraLinha } from '../../db/linhas.js';
import {
  comoContaId,
  comoProjetoId,
  type ContaId,
  type ProjetoId,
  type UsuarioId,
} from '../../shared/ids.js';
import { calcularDeslocamento, type EntradaPaginacao } from '../../shared/pagination.js';

export interface Projeto {
  id: ProjetoId;
  contaId: ContaId;
  nome: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

interface LinhaDeProjeto {
  id: string;
  conta_id: string;
  nome: string;
  criado_em: Date;
  atualizado_em: Date;
}

const COLUNAS = 'id, conta_id, nome, criado_em, atualizado_em';

function mapear(linha: LinhaDeProjeto): Projeto {
  return {
    id: comoProjetoId(linha.id),
    contaId: comoContaId(linha.conta_id),
    nome: linha.nome,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

export class ProjetosRepositorio {
  constructor(private readonly banco: Banco) {}

  async criar(contaId: ContaId, nome: string, criadoPor: UsuarioId): Promise<Projeto> {
    const resultado = await this.banco.query<LinhaDeProjeto>(
      `INSERT INTO projetos (conta_id, nome, criado_por) VALUES ($1, $2, $3) RETURNING ${COLUNAS}`,
      [contaId, nome, criadoPor],
    );
    return mapear(exigirPrimeiraLinha(resultado.rows));
  }

  async listar(
    contaId: ContaId,
    paginacao: EntradaPaginacao,
  ): Promise<{ projetos: Projeto[]; total: number }> {
    const [itens, total] = await Promise.all([
      this.banco.query<LinhaDeProjeto>(
        `SELECT ${COLUNAS} FROM projetos WHERE conta_id = $1
          ORDER BY criado_em DESC, id LIMIT $2 OFFSET $3`,
        [contaId, paginacao.tamanhoPagina, calcularDeslocamento(paginacao)],
      ),
      this.banco.query<{ total: string }>(
        'SELECT count(*) AS total FROM projetos WHERE conta_id = $1',
        [contaId],
      ),
    ]);
    return {
      projetos: itens.rows.map(mapear),
      total: Number(total.rows[0]?.total ?? 0),
    };
  }

  async buscarPorId(contaId: ContaId, projetoId: ProjetoId): Promise<Projeto | undefined> {
    const resultado = await this.banco.query<LinhaDeProjeto>(
      `SELECT ${COLUNAS} FROM projetos WHERE conta_id = $1 AND id = $2`,
      [contaId, projetoId],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  async renomear(
    contaId: ContaId,
    projetoId: ProjetoId,
    nome: string,
  ): Promise<Projeto | undefined> {
    const resultado = await this.banco.query<LinhaDeProjeto>(
      `UPDATE projetos SET nome = $3, atualizado_em = now()
        WHERE conta_id = $1 AND id = $2 RETURNING ${COLUNAS}`,
      [contaId, projetoId, nome],
    );
    const linha = resultado.rows[0];
    return linha && mapear(linha);
  }

  async apagar(
    contaId: ContaId,
    projetoId: ProjetoId,
    executor: Executor = this.banco,
  ): Promise<boolean> {
    const resultado = await executor.query('DELETE FROM projetos WHERE conta_id = $1 AND id = $2', [
      contaId,
      projetoId,
    ]);
    return resultado.rowCount === 1;
  }
}

export function criarProjetosRepositorio(banco: Banco): ProjetosRepositorio {
  return new ProjetosRepositorio(banco);
}
