export const ESCOPOS_DO_GOOGLE = [
  'https://www.googleapis.com/auth/business.manage',
  'openid',
  'email',
] as const;

export interface TokensDoGoogle {
  tokenAcesso: string;
  expiraEm: Date;
  escopos: string[];
}

export interface TokensDaConexao extends TokensDoGoogle {
  tokenAtualizacao: string;
  email: string;
}

export interface ContaDoGoogle {
  /** Formato `accounts/{accountId}`. */
  id: string;
  nome: string;
}

export interface UnidadeDoGoogle {
  /** Formato da API v4 de avaliações: `accounts/{accountId}/locations/{locationId}`. */
  nome: string;
  titulo: string;
  endereco: string | null;
}

export interface AvaliacaoDoGoogle {
  id: string;
  nota: number | null;
  comentario: string | null;
  autor: string | null;
  criadaEm: Date;
  atualizadaEm: Date;
}

export interface PaginaDeAvaliacoes {
  avaliacoes: AvaliacaoDoGoogle[];
  proximaPagina: string | null;
}

export type TipoDeErroDoGoogle =
  'nao_autorizado' | 'concessao_invalida' | 'sem_acesso' | 'limite' | 'indisponivel';

// Só o tipo e o status chegam à mensagem: a resposta do Google pode trazer dado do cliente.
export class ErroDoGoogle extends Error {
  constructor(
    readonly tipo: TipoDeErroDoGoogle,
    readonly statusHttp?: number,
  ) {
    super(tipo);
    this.name = 'ErroDoGoogle';
  }
}

export const TAMANHO_DA_PAGINA_DE_AVALIACOES = 50;

export interface FonteDeAvaliacoes {
  urlDeAutorizacao(state: string): string;
  trocarCodigo(codigo: string): Promise<TokensDaConexao>;
  renovarToken(tokenAtualizacao: string): Promise<TokensDoGoogle>;
  revogar(token: string): Promise<void>;
  listarContas(tokenAcesso: string): Promise<ContaDoGoogle[]>;
  listarUnidades(tokenAcesso: string, contaId: string): Promise<UnidadeDoGoogle[]>;
  /** Do mais recente para o mais antigo, pela data de atualização. */
  listarAvaliacoes(
    tokenAcesso: string,
    unidade: string,
    paginaToken: string | null,
  ): Promise<PaginaDeAvaliacoes>;
}
