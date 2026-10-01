import { setTimeout as esperar } from 'node:timers/promises';

const INTERVALO_DE_CONSULTA_MS = 15;

export async function aguardarAte(
  condicao: () => Promise<boolean>,
  limiteMs = 5_000,
): Promise<void> {
  const limite = Date.now() + limiteMs;
  while (!(await condicao())) {
    if (Date.now() > limite) {
      throw new Error('A condição esperada não aconteceu a tempo.');
    }
    await esperar(INTERVALO_DE_CONSULTA_MS);
  }
}
