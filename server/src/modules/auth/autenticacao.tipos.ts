import type { ContaId, TokenId, UsuarioId } from '../../shared/ids.js';

export type Papel = 'owner' | 'member';

export type TipoDeToken = 'email_verification' | 'password_reset' | 'invitation' | 'email_change';

export interface Usuario {
  id: UsuarioId;
  contaId: ContaId;
  nome: string;
  email: string;
  emailConfirmadoEm: Date | null;
  papel: Papel;
  criadoEm: Date;
}

export interface UsuarioComSenha extends Usuario {
  hashSenha: string;
  tentativasLoginFalhas: number;
  bloqueadoAte: Date | null;
}

export interface TokenAutenticacao {
  id: TokenId;
  contaId: ContaId;
  usuarioId: UsuarioId | null;
  tipo: TipoDeToken;
  email: string;
  papelConvidado: Papel | null;
  expiraEm: Date;
  usadoEm: Date | null;
  criadoEm: Date;
}

export interface ContextoAutenticado {
  usuarioId: UsuarioId;
  contaId: ContaId;
  papel: Papel;
  emailConfirmado: boolean;
}

export interface EncerradorDeSessoes {
  encerrarDoUsuario(usuarioId: UsuarioId, exceto?: string): Promise<void>;
  encerrarDaConta(contaId: ContaId): Promise<void>;
}
