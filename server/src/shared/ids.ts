// Tipos de marca: o compilador impede trocar um id por outro.
declare const marca: unique symbol;

type Marcado<Nome extends string> = string & { readonly [marca]: Nome };

export type ContaId = Marcado<'ContaId'>;
export type UsuarioId = Marcado<'UsuarioId'>;
export type ProjetoId = Marcado<'ProjetoId'>;
export type ComentarioId = Marcado<'ComentarioId'>;
export type FonteId = Marcado<'FonteId'>;
export type TrabalhoId = Marcado<'TrabalhoId'>;
export type TokenId = Marcado<'TokenId'>;

export function comoContaId(valor: string): ContaId {
  return valor as ContaId;
}

export function comoUsuarioId(valor: string): UsuarioId {
  return valor as UsuarioId;
}

export function comoProjetoId(valor: string): ProjetoId {
  return valor as ProjetoId;
}

export function comoComentarioId(valor: string): ComentarioId {
  return valor as ComentarioId;
}

export function comoFonteId(valor: string): FonteId {
  return valor as FonteId;
}

export function comoTrabalhoId(valor: string): TrabalhoId {
  return valor as TrabalhoId;
}

export function comoTokenId(valor: string): TokenId {
  return valor as TokenId;
}
