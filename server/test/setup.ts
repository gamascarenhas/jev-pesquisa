import pg from 'pg';

import { carregarConfiguracaoDeTeste } from './helpers/build-app.js';

function trocarBanco(url: string, nomeDoBanco: string): string {
  const alterada = new URL(url);
  alterada.pathname = `/${nomeDoBanco}`;
  return alterada.toString();
}

async function criarBancoSeNaoExistir(urlBancoTestes: string): Promise<void> {
  const nome = new URL(urlBancoTestes).pathname.slice(1);
  // O volume pode ter sido criado antes do script de inicialização.
  const administrativo = new pg.Client({
    connectionString: trocarBanco(urlBancoTestes, 'postgres'),
  });
  await administrativo.connect();
  try {
    const existe = await administrativo.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      nome,
    ]);
    if (existe.rowCount === 0) {
      await administrativo.query(`CREATE DATABASE "${nome.replaceAll('"', '""')}"`);
    }
  } finally {
    await administrativo.end();
  }
}

export async function setup(): Promise<void> {
  const { urlBanco } = carregarConfiguracaoDeTeste();
  await criarBancoSeNaoExistir(urlBanco);
  const cliente = new pg.Client({ connectionString: urlBanco });
  await cliente.connect();
  try {
    await cliente.query('DROP SCHEMA IF EXISTS public CASCADE');
    await cliente.query('CREATE SCHEMA public');
  } finally {
    await cliente.end();
  }
}
