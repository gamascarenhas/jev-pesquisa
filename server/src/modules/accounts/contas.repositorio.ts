import type { Banco, Executor } from '../../db/conexoes.js';
import { comoContaId, type ContaId } from '../../shared/ids.js';

export interface Conta {
  id: ContaId;
  nome: string;
  planoId: string;
  planoNome: string;
  cicloIniciadoEm: Date;
  cicloTerminaEm: Date;
}

interface LinhaDeConta {
  id: string;
  nome: string;
  plano_id: string;
  plano_nome: string;
  ciclo_iniciado_em: Date;
  ciclo_termina_em: Date;
}

export class ContasRepositorio {
  constructor(private readonly banco: Banco) {}

  async buscarPorId(contaId: ContaId): Promise<Conta | undefined> {
    const resultado = await this.banco.query<LinhaDeConta>(
      `SELECT c.id, c.nome, c.plano_id, p.nome AS plano_nome, c.ciclo_iniciado_em, c.ciclo_termina_em
         FROM contas c JOIN planos p ON p.id = c.plano_id
        WHERE c.id = $1`,
      [contaId],
    );
    const linha = resultado.rows[0];
    return (
      linha && {
        id: comoContaId(linha.id),
        nome: linha.nome,
        planoId: linha.plano_id,
        planoNome: linha.plano_nome,
        cicloIniciadoEm: linha.ciclo_iniciado_em,
        cicloTerminaEm: linha.ciclo_termina_em,
      }
    );
  }

  async apagar(contaId: ContaId, executor: Executor = this.banco): Promise<boolean> {
    const resultado = await executor.query('DELETE FROM contas WHERE id = $1', [contaId]);
    return resultado.rowCount === 1;
  }
}

export function criarContasRepositorio(banco: Banco): ContasRepositorio {
  return new ContasRepositorio(banco);
}
