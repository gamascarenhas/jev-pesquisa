import type { ContaId, ProjetoId, TrabalhoId, UsuarioId } from '../shared/ids.js';

export const TIPOS_DE_TRABALHO = [
  'import_upload',
  'classify',
  'ask',
  'summarize',
  'google_sync',
] as const;
export type TipoDeTrabalho = (typeof TIPOS_DE_TRABALHO)[number];

export type StatusDeTrabalho =
  'pending' | 'running' | 'paused_limit' | 'done' | 'failed' | 'cancelled';

export interface Trabalho {
  id: TrabalhoId;
  contaId: ContaId;
  projetoId: ProjetoId | undefined;
  tipo: TipoDeTrabalho;
  status: StatusDeTrabalho;
  carga: Record<string, unknown>;
  progressoTotal: number;
  progressoFeito: number;
  tentativas: number;
  maxTentativas: number;
  criadoEm: Date;
  iniciadoEm: Date | undefined;
  finalizadoEm: Date | undefined;
}

export interface ContextoDoTrabalho {
  trabalho: Trabalho;
  /** Dispara quando o executor devolve o job (desligamento ou bloqueio perdido); o handler deve parar. */
  sinal: AbortSignal;
  atualizarProgresso: (total: number, feito: number) => Promise<void>;
}

// A pausa por limite de custo só acontece por ErroLimiteDeCustoAtingido; o handler nunca devolve status.
export type ManipuladorDeTrabalho = (contexto: ContextoDoTrabalho) => Promise<void>;

export type MapaDeManipuladores = Partial<Record<TipoDeTrabalho, ManipuladorDeTrabalho>>;

export interface GanchoDeRecuperacao {
  nome: string;
  executar(): Promise<void>;
}

/** O código é um identificador curto e fixo, nunca texto de comentário: vai para `ultimo_erro`. */
export class ErroTemporarioDeTrabalho extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
    this.name = 'ErroTemporarioDeTrabalho';
  }
}

export interface EntradaDeNovoTrabalho {
  tipo: TipoDeTrabalho;
  projetoId?: ProjetoId;
  carga?: Record<string, unknown>;
  criadoPor?: UsuarioId;
  maxTentativas?: number;
}
