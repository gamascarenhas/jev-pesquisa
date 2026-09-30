// Para INSERT ... RETURNING e consultas que sempre devolvem uma linha.
export function exigirPrimeiraLinha<T>(linhas: T[]): T {
  const primeira = linhas[0];
  if (primeira === undefined) {
    throw new Error('A consulta esperava ao menos uma linha.');
  }
  return primeira;
}
