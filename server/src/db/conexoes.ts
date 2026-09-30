import pg from 'pg';

export type Banco = pg.Pool;
export type ClienteBanco = pg.PoolClient;

export const TAMANHO_MAXIMO_POOL = 10;
export const STATEMENT_TIMEOUT_MS = 30_000;
const TEMPO_LIMITE_CONEXAO_MS = 10_000;

export function criarBanco(urlBanco: string): Banco {
  return new pg.Pool({
    connectionString: urlBanco,
    max: TAMANHO_MAXIMO_POOL,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: TEMPO_LIMITE_CONEXAO_MS,
  });
}

export async function verificarBanco(banco: Banco): Promise<void> {
  await banco.query('SELECT 1');
}

export type Executor = Banco | ClienteBanco;
