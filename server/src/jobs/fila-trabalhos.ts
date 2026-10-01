import type { Banco } from '../db/conexoes.js';
import type { TrabalhoId } from '../shared/ids.js';
import {
  COLUNAS_DE_TRABALHO,
  mapearTrabalho,
  type LinhaDeTrabalho,
} from './trabalhos.repositorio.js';
import type { TipoDeTrabalho, Trabalho } from './trabalhos.tipos.js';

export interface ResultadoDaRecuperacao {
  devolvidos: number;
  falhos: number;
}

const LIBERAR_BLOQUEIO = 'bloqueado_por = NULL, bloqueado_em = NULL';
const SOMENTE_DO_DONO = "id = $1 AND status = 'running' AND bloqueado_por = $2";

export class FilaTrabalhos {
  constructor(private readonly banco: Banco) {}

  // Atravessa contas: a fila serve todas as contas e escolhe o próximo job só por tipo e horário.
  async reivindicarProximo(
    instanciaId: string,
    tipos: TipoDeTrabalho[],
    agora: Date,
  ): Promise<Trabalho | undefined> {
    if (tipos.length === 0) {
      return undefined;
    }
    const resultado = await this.banco.query<LinhaDeTrabalho>(
      `UPDATE trabalhos
          SET status = 'running', bloqueado_por = $1, bloqueado_em = $2, sinal_vida_em = $2,
              iniciado_em = COALESCE(iniciado_em, $2), tentativas = tentativas + 1
        WHERE id = (
          SELECT id FROM trabalhos
           WHERE status = 'pending' AND executar_apos <= $2 AND tipo = ANY($3::text[])
           ORDER BY executar_apos, criado_em
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
       RETURNING ${COLUNAS_DE_TRABALHO}`,
      [instanciaId, agora, tipos],
    );
    const linha = resultado.rows[0];
    return linha && mapearTrabalho(linha);
  }

  // Atravessa contas: o executor identifica o job só pelo id; falso quando o bloqueio foi perdido.
  async registrarSinalDeVida(
    trabalhoId: TrabalhoId,
    instanciaId: string,
    agora: Date,
  ): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET sinal_vida_em = $3 WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId, agora],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: o handler atualiza o progresso do job que o executor lhe entregou.
  async atualizarProgresso(
    trabalhoId: TrabalhoId,
    instanciaId: string,
    total: number,
    feito: number,
  ): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET progresso_total = $3, progresso_feito = $4 WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId, total, feito],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: o executor encerra o job pelo id.
  async concluir(trabalhoId: TrabalhoId, instanciaId: string, agora: Date): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'done', finalizado_em = $3, ultimo_erro = NULL, ${LIBERAR_BLOQUEIO}
        WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId, agora],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: o executor encerra o job pelo id.
  async falhar(
    trabalhoId: TrabalhoId,
    instanciaId: string,
    agora: Date,
    erro: string,
  ): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'failed', finalizado_em = $3, ultimo_erro = $4, ${LIBERAR_BLOQUEIO}
        WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId, agora, erro],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: o executor reagenda o job pelo id.
  async reagendar(
    trabalhoId: TrabalhoId,
    instanciaId: string,
    executarApos: Date,
    erro: string,
  ): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'pending', executar_apos = $3, ultimo_erro = $4, ${LIBERAR_BLOQUEIO}
        WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId, executarApos, erro],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: o executor pausa o job pelo id; a pausa não gasta tentativa.
  async pausarPorLimite(trabalhoId: TrabalhoId, instanciaId: string): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'paused_limit', tentativas = GREATEST(tentativas - 1, 0),
              ${LIBERAR_BLOQUEIO}
        WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: o desligamento devolve o job pelo id; a interrupção não gasta tentativa.
  async devolverParaPendente(trabalhoId: TrabalhoId, instanciaId: string): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'pending', tentativas = GREATEST(tentativas - 1, 0),
              ${LIBERAR_BLOQUEIO}
        WHERE ${SOMENTE_DO_DONO}`,
      [trabalhoId, instanciaId],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: a reavaliação de limite devolve jobs pausados de qualquer conta, pelo id.
  async retomarPausado(trabalhoId: TrabalhoId, agora: Date): Promise<boolean> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'pending', executar_apos = $2
        WHERE id = $1 AND status = 'paused_limit'`,
      [trabalhoId, agora],
    );
    return resultado.rowCount === 1;
  }

  // Atravessa contas: jobs órfãos de qualquer conta, achados só pelo sinal de vida vencido.
  async recuperarOrfaos(sinalDeVidaAnteriorA: Date, agora: Date): Promise<ResultadoDaRecuperacao> {
    const falhos = await this.banco.query(
      `UPDATE trabalhos SET status = 'failed', finalizado_em = $2, ${LIBERAR_BLOQUEIO},
              ultimo_erro = 'interrompido_repetidamente'
        WHERE status = 'running' AND sinal_vida_em < $1 AND tentativas >= max_tentativas`,
      [sinalDeVidaAnteriorA, agora],
    );
    const devolvidos = await this.banco.query(
      `UPDATE trabalhos SET status = 'pending', ${LIBERAR_BLOQUEIO}
        WHERE status = 'running' AND sinal_vida_em < $1`,
      [sinalDeVidaAnteriorA],
    );
    return { devolvidos: devolvidos.rowCount ?? 0, falhos: falhos.rowCount ?? 0 };
  }
}

export function criarFilaTrabalhos(banco: Banco): FilaTrabalhos {
  return new FilaTrabalhos(banco);
}
