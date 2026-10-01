import type { ContaId, ProjetoId, UsuarioId } from '../../shared/ids.js';

export interface ConexaoGoogle {
  id: string;
  contaId: ContaId;
  projetoId: ProjetoId;
  email: string;
  tokenAtualizacaoCifrado: string | null;
  tokenAcessoCifrado: string | null;
  tokenAcessoExpiraEm: Date | null;
  escopos: string[];
  conectadoPor: UsuarioId | null;
  revogadoEm: Date | null;
}

export interface NovaConexaoGoogle {
  email: string;
  tokenAtualizacaoCifrado: string;
  tokenAcessoCifrado: string;
  tokenAcessoExpiraEm: Date;
  escopos: string[];
}

export interface FonteGoogle {
  id: string;
  nomeUnidade: string;
  titulo: string;
  ultimaSincronizacaoEm: Date | null;
  falha: { codigo: string; mensagem: string } | null;
}
