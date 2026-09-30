import type { Banco } from '../../db/conexoes.js';

export interface Plano {
  id: string;
  nome: string;
  precoMensalCentavos: number;
}

interface LinhaDePlano {
  id: string;
  nome: string;
  preco_mensal_centavos: number;
}

export class PlanosSistemaRepositorio {
  constructor(private readonly banco: Banco) {}

  // Planos são globais, sem conta_id; a listagem é a mesma para todas as contas.
  async listarAtivos(): Promise<Plano[]> {
    const resultado = await this.banco.query<LinhaDePlano>(
      'SELECT id, nome, preco_mensal_centavos FROM planos WHERE ativo ORDER BY ordem, id',
    );
    return resultado.rows.map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      precoMensalCentavos: linha.preco_mensal_centavos,
    }));
  }
}

export function criarPlanosSistemaRepositorio(banco: Banco): PlanosSistemaRepositorio {
  return new PlanosSistemaRepositorio(banco);
}
