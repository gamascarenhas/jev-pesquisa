import type { Registrador } from './logger.js';

export type AcaoDeAuditoria =
  | 'login_sucesso'
  | 'login_falha'
  | 'senha_trocada'
  | 'senha_redefinida'
  | 'email_trocado'
  | 'convite_criado'
  | 'convite_revogado'
  | 'usuario_removido'
  | 'projeto_apagado'
  | 'conta_encerrada';

export interface IdsDeAuditoria {
  contaId?: string;
  usuarioId?: string;
  alvoId?: string;
}

export function registrarAuditoria(
  registrador: Registrador,
  acao: AcaoDeAuditoria,
  ids: IdsDeAuditoria = {},
): void {
  registrador.info({ categoria: 'auditoria', acao, ...ids }, 'evento de auditoria');
}
