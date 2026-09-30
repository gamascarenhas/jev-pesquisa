import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Registrador } from '../shared/logger.js';
import type { Banco, ClienteBanco } from './conexoes.js';

export const DIRETORIO_MIGRATIONS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);

// Chave do advisory lock: uma instância migra por vez.
const CHAVE_TRAVA_MIGRACAO = '7240018841';
const PADRAO_NOME_MIGRATION = /^\d{4}_[a-z0-9_]+\.sql$/;

export class ErroDeMigracao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeMigracao';
  }
}

interface ArquivoMigration {
  versao: string;
  sql: string;
  checksum: string;
}

function calcularChecksum(sql: string): string {
  // Normaliza CRLF: o checksum não pode variar entre Windows e Linux.
  return createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
}

async function lerArquivos(diretorio: string): Promise<ArquivoMigration[]> {
  const nomes = (await readdir(diretorio)).filter((nome) => nome.endsWith('.sql')).sort();
  const invalido = nomes.find((nome) => !PADRAO_NOME_MIGRATION.test(nome));
  if (invalido !== undefined) {
    throw new ErroDeMigracao(`Nome de migration fora do padrão NNNN_descricao.sql: ${invalido}`);
  }
  return Promise.all(
    nomes.map(async (versao) => {
      const sql = await readFile(join(diretorio, versao), 'utf8');
      return { versao, sql, checksum: calcularChecksum(sql) };
    }),
  );
}

async function lerChecksumsAplicados(cliente: ClienteBanco): Promise<Map<string, string>> {
  const existe = await cliente.query<{ existe: boolean }>(
    "SELECT to_regclass('migracoes_aplicadas') IS NOT NULL AS existe",
  );
  if (existe.rows[0]?.existe !== true) {
    return new Map();
  }
  const aplicadas = await cliente.query<{ versao: string; checksum: string }>(
    'SELECT versao, checksum FROM migracoes_aplicadas',
  );
  return new Map(aplicadas.rows.map((linha) => [linha.versao, linha.checksum]));
}

function conferirIntegridade(arquivos: ArquivoMigration[], aplicadas: Map<string, string>): void {
  const versoes = new Set(arquivos.map((arquivo) => arquivo.versao));
  for (const versao of aplicadas.keys()) {
    if (!versoes.has(versao)) {
      throw new ErroDeMigracao(`A migration já aplicada ${versao} não existe mais em disco.`);
    }
  }
  for (const arquivo of arquivos) {
    const checksumAplicado = aplicadas.get(arquivo.versao);
    if (checksumAplicado !== undefined && checksumAplicado !== arquivo.checksum) {
      throw new ErroDeMigracao(
        `A migration ${arquivo.versao} já foi aplicada e foi alterada. Migration aplicada nunca é editada: crie uma nova.`,
      );
    }
  }
}

async function aplicarUma(cliente: ClienteBanco, arquivo: ArquivoMigration): Promise<void> {
  try {
    await cliente.query('BEGIN');
    await cliente.query(arquivo.sql);
    await cliente.query('INSERT INTO migracoes_aplicadas (versao, checksum) VALUES ($1, $2)', [
      arquivo.versao,
      arquivo.checksum,
    ]);
    await cliente.query('COMMIT');
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw new ErroDeMigracao(
      `Falha ao aplicar ${arquivo.versao}: ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  }
}

/** Aplica as pendentes em ordem; recusa se uma já aplicada mudou ou sumiu. */
export async function aplicarMigracoes(
  banco: Banco,
  registrador: Registrador,
  diretorio: string = DIRETORIO_MIGRATIONS,
): Promise<string[]> {
  const arquivos = await lerArquivos(diretorio);
  const cliente = await banco.connect();
  const aplicadasAgora: string[] = [];
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [CHAVE_TRAVA_MIGRACAO]);
    const aplicadas = await lerChecksumsAplicados(cliente);
    conferirIntegridade(arquivos, aplicadas);
    for (const arquivo of arquivos.filter((a) => !aplicadas.has(a.versao))) {
      await aplicarUma(cliente, arquivo);
      aplicadasAgora.push(arquivo.versao);
      registrador.info({ migration: arquivo.versao }, 'migration aplicada');
    }
  } finally {
    await cliente.query('SELECT pg_advisory_unlock($1)', [CHAVE_TRAVA_MIGRACAO]);
    cliente.release();
  }
  return aplicadasAgora;
}
