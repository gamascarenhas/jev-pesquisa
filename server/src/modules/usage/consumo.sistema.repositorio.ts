import type { Banco } from '../../db/conexoes.js';
import { comoContaId, comoTrabalhoId, type ContaId, type TrabalhoId } from '../../shared/ids.js';
import { usdTextoParaUnidades, type UnidadesUsd } from './valores-usd.js';

export interface JobPausadoPorLimite {
  trabalhoId: TrabalhoId;
  contaId: ContaId;
  consumidoUsd8: UnidadesUsd;
  limiteUsd8: UnidadesUsd;
}

interface LinhaDePausado {
  trabalho_id: string;
  conta_id: string;
  consumido: string;
  limite: string;
}

export class ConsumoSistemaRepositorio {
  constructor(private readonly banco: Banco) {}

  // Atravessa contas: a limpeza de reservas esquecidas por uma queda do servidor vale para todas as contas.
  async liberarReservasAntigas(criadasAntesDe: Date, agora: Date): Promise<number> {
    const resultado = await this.banco.query(
      `UPDATE livro_razao_consumo SET status = 'released', finalizado_em = $2
        WHERE status = 'reserved' AND criado_em < $1`,
      [criadasAntesDe, agora],
    );
    return resultado.rowCount ?? 0;
  }

  // Atravessa contas: a virada de ciclo procura as contas de todos os clientes cujo ciclo venceu.
  async listarContasComCicloVencido(agora: Date): Promise<ContaId[]> {
    const resultado = await this.banco.query<{ id: string }>(
      'SELECT id FROM contas WHERE ciclo_termina_em <= $1 ORDER BY ciclo_termina_em',
      [agora],
    );
    return resultado.rows.map((linha) => comoContaId(linha.id));
  }

  // Atravessa contas: a reavaliação na inicialização olha os jobs pausados de todas as contas.
  async listarJobsPausadosPorLimite(): Promise<JobPausadoPorLimite[]> {
    const resultado = await this.banco.query<LinhaDePausado>(
      `SELECT t.id AS trabalho_id, t.conta_id, p.limite_custo_ia_usd::text AS limite,
              COALESCE((SELECT SUM(CASE l.status WHEN 'settled' THEN l.real_usd
                                                  WHEN 'reserved' THEN l.reservado_usd END)
                          FROM livro_razao_consumo l
                         WHERE l.conta_ref = c.id AND l.ciclo_iniciado_em = c.ciclo_iniciado_em),
                       0)::text AS consumido
         FROM trabalhos t
         JOIN contas c ON c.id = t.conta_id
         JOIN planos p ON p.id = c.plano_id
        WHERE t.status = 'paused_limit'
        ORDER BY t.criado_em`,
    );
    return resultado.rows.map((linha) => ({
      trabalhoId: comoTrabalhoId(linha.trabalho_id),
      contaId: comoContaId(linha.conta_id),
      consumidoUsd8: usdTextoParaUnidades(linha.consumido),
      limiteUsd8: usdTextoParaUnidades(linha.limite),
    }));
  }
}

export function criarConsumoSistemaRepositorio(banco: Banco): ConsumoSistemaRepositorio {
  return new ConsumoSistemaRepositorio(banco);
}
