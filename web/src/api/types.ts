export type Papel = 'owner' | 'member';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  emailConfirmado: boolean;
  criadoEm: string;
}

export interface Convite {
  id: string;
  email: string;
  papel: Papel;
  criadoEm: string;
  expiraEm: string;
}

export interface Projeto {
  id: string;
  nome: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Conta {
  id: string;
  nome: string;
  plano: { id: string; nome: string };
  cicloTerminaEm: string;
}

export interface ConfiguracaoPublica {
  nomeNegocio: string;
}

export interface Pagina<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

export interface Lista<T> {
  itens: T[];
}

export interface Mensagem {
  mensagem: string;
}
