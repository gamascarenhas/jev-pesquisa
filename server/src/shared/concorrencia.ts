// Executa as tarefas com no máximo `tamanho` em andamento ao mesmo tempo.
export async function executarEmPiscina<R>(
  itens: R[],
  tamanho: number,
  tarefa: (item: R, indice: number) => Promise<void>,
): Promise<void> {
  let proximo = 0;
  const trabalhador = async (): Promise<void> => {
    while (proximo < itens.length) {
      const indice = proximo;
      proximo += 1;
      await tarefa(itens[indice] as R, indice);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(tamanho, itens.length)) }, trabalhador),
  );
}
