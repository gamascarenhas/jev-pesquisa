import type { Banco } from '../../db/conexoes.js';
import { comoContaId, comoProjetoId, type ContaId, type ProjetoId } from '../../shared/ids.js';

export interface ProjetoParaSincronizar {
  contaId: ContaId;
  projetoId: ProjetoId;
}

export class ConexoesGoogleSistemaRepositorio {
  constructor(private readonly banco: Banco) {}

  // Atravessa contas: o agendador sincroniza as conexões ativas de todos os clientes.
  async listarProjetosComConexaoAtiva(): Promise<ProjetoParaSincronizar[]> {
    const resultado = await this.banco.query<{ conta_id: string; projeto_id: string }>(
      `SELECT c.conta_id, c.projeto_id FROM conexoes_google c
        WHERE c.revogado_em IS NULL
          AND EXISTS (SELECT 1 FROM fontes f
                       WHERE f.projeto_id = c.projeto_id AND f.tipo = 'google_business')
        ORDER BY c.criado_em`,
    );
    return resultado.rows.map((linha) => ({
      contaId: comoContaId(linha.conta_id),
      projetoId: comoProjetoId(linha.projeto_id),
    }));
  }
}

export function criarConexoesGoogleSistemaRepositorio(
  banco: Banco,
): ConexoesGoogleSistemaRepositorio {
  return new ConexoesGoogleSistemaRepositorio(banco);
}
