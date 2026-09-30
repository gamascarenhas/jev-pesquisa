import type { Banco, ClienteBanco } from './conexoes.js';

export async function comTransacao<T>(
  banco: Banco,
  operacao: (cliente: ClienteBanco) => Promise<T>,
): Promise<T> {
  const cliente = await banco.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await operacao(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
}
