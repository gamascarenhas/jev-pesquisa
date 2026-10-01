import type { Banco } from '../db/conexoes.js';
import {
  comoContaId,
  comoProjetoId,
  comoTrabalhoId,
  type ContaId,
  type ProjetoId,
  type TrabalhoId,
} from '../shared/ids.js';
import type {
  EntradaDeNovoTrabalho,
  StatusDeTrabalho,
  TipoDeTrabalho,
  Trabalho,
} from './trabalhos.tipos.js';

export interface LinhaDeTrabalho {
  id: string;
  conta_id: string;
  projeto_id: string | null;
  tipo: TipoDeTrabalho;
  status: StatusDeTrabalho;
  carga: Record<string, unknown>;
  progresso_total: number;
  progresso_feito: number;
  tentativas: number;
  max_tentativas: number;
  criado_em: Date;
  iniciado_em: Date | null;
  finalizado_em: Date | null;
}

export const COLUNAS_DE_TRABALHO = `id, conta_id, projeto_id, tipo, status, carga, progresso_total,
  progresso_feito, tentativas, max_tentativas, criado_em, iniciado_em, finalizado_em`;

const STATUS_ATIVOS = "('pending', 'running', 'paused_limit')";

export function mapearTrabalho(linha: LinhaDeTrabalho): Trabalho {
  return {
    id: comoTrabalhoId(linha.id),
    contaId: comoContaId(linha.conta_id),
    projetoId: linha.projeto_id === null ? undefined : comoProjetoId(linha.projeto_id),
    tipo: linha.tipo,
    status: linha.status,
    carga: linha.carga,
    progressoTotal: linha.progresso_total,
    progressoFeito: linha.progresso_feito,
    tentativas: linha.tentativas,
    maxTentativas: linha.max_tentativas,
    criadoEm: linha.criado_em,
    iniciadoEm: linha.iniciado_em ?? undefined,
    finalizadoEm: linha.finalizado_em ?? undefined,
  };
}

export class TrabalhosRepositorio {
  constructor(private readonly banco: Banco) {}

  // Os índices únicos parciais decidem a colisão; sem linha devolvida, já existe um job ativo.
  async criarSeNaoHouverAtivo(
    contaId: ContaId,
    entrada: EntradaDeNovoTrabalho,
  ): Promise<Trabalho | undefined> {
    const resultado = await this.banco.query<LinhaDeTrabalho>(
      `INSERT INTO trabalhos (conta_id, projeto_id, tipo, carga, criado_por, max_tentativas)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 5))
       ON CONFLICT DO NOTHING
       RETURNING ${COLUNAS_DE_TRABALHO}`,
      [
        contaId,
        entrada.projetoId ?? null,
        entrada.tipo,
        JSON.stringify(entrada.carga ?? {}),
        entrada.criadoPor ?? null,
        entrada.maxTentativas ?? null,
      ],
    );
    const linha = resultado.rows[0];
    return linha && mapearTrabalho(linha);
  }

  async buscarAtivoEquivalente(
    contaId: ContaId,
    entrada: EntradaDeNovoTrabalho,
  ): Promise<Trabalho | undefined> {
    const porPergunta = entrada.tipo === 'ask';
    const resultado = await this.banco.query<LinhaDeTrabalho>(
      `SELECT ${COLUNAS_DE_TRABALHO} FROM trabalhos
        WHERE conta_id = $1 AND tipo = $2 AND status IN ${STATUS_ATIVOS}
          AND ${porPergunta ? "carga->>'perguntaId' = $3" : 'projeto_id = $3'}
        ORDER BY criado_em LIMIT 1`,
      [contaId, entrada.tipo, porPergunta ? entrada.carga?.perguntaId : entrada.projetoId],
    );
    const linha = resultado.rows[0];
    return linha && mapearTrabalho(linha);
  }

  async listarAtivosDoTipo(contaId: ContaId, tipo: TipoDeTrabalho): Promise<Trabalho[]> {
    const resultado = await this.banco.query<LinhaDeTrabalho>(
      `SELECT ${COLUNAS_DE_TRABALHO} FROM trabalhos
        WHERE conta_id = $1 AND tipo = $2 AND status IN ${STATUS_ATIVOS}`,
      [contaId, tipo],
    );
    return resultado.rows.map(mapearTrabalho);
  }

  // Só o que ainda não começou: um job em execução termina sozinho, e a sincronização confere a conexão.
  async cancelarNaoIniciados(
    contaId: ContaId,
    projetoId: ProjetoId,
    tipo: TipoDeTrabalho,
  ): Promise<number> {
    const resultado = await this.banco.query(
      `UPDATE trabalhos SET status = 'cancelled', finalizado_em = now()
        WHERE conta_id = $1 AND projeto_id = $2 AND tipo = $3 AND status = 'pending'`,
      [contaId, projetoId, tipo],
    );
    return resultado.rowCount ?? 0;
  }

  async buscarPorId(contaId: ContaId, trabalhoId: TrabalhoId): Promise<Trabalho | undefined> {
    const resultado = await this.banco.query<LinhaDeTrabalho>(
      `SELECT ${COLUNAS_DE_TRABALHO} FROM trabalhos WHERE conta_id = $1 AND id = $2`,
      [contaId, trabalhoId],
    );
    const linha = resultado.rows[0];
    return linha && mapearTrabalho(linha);
  }
}

export function criarTrabalhosRepositorio(banco: Banco): TrabalhosRepositorio {
  return new TrabalhosRepositorio(banco);
}
