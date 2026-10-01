// Probabilidade mínima para tratar um comentário como "precisa de ação"; todo filtro e contador usa esta função.
export const LIMIAR_PRECISA_ACAO = 0.5;

export function precisaDeAcao(probabilidade: number): boolean {
  return probabilidade >= LIMIAR_PRECISA_ACAO;
}
