import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { criarBanco, type Banco } from '../../../src/db/conexoes.js';
import { aplicarMigracoes, DIRETORIO_MIGRATIONS, ErroDeMigracao } from '../../../src/db/migrar.js';
import { carregarConfiguracaoDeTeste } from '../../helpers/build-app.js';
import { criarRegistradorCapturado } from '../../helpers/factories.js';

const { urlBanco } = carregarConfiguracaoDeTeste();
const { registrador } = criarRegistradorCapturado();
const MIGRATIONS_ATUAIS = [
  '0001_extensoes.sql',
  '0002_planos.sql',
  '0003_contas_usuarios.sql',
  '0004_tokens_autenticacao_sessoes.sql',
  '0005_projetos.sql',
  '0006_trabalhos.sql',
  '0007_fontes.sql',
  '0008_comentarios.sql',
  '0009_livro_razao_consumo.sql',
  '0010_classificacoes_revisoes.sql',
  '0011_alertas_consumo.sql',
  '0012_execucoes_agendadas.sql',
  '0013_conexoes_google.sql',
  '0014_resumos_tema.sql',
];
const bancos: Banco[] = [];
const diretorios: string[] = [];

function abrirBanco(): Banco {
  const banco = criarBanco(urlBanco);
  bancos.push(banco);
  return banco;
}

async function recriarEsquema(banco: Banco): Promise<void> {
  await banco.query('DROP SCHEMA IF EXISTS public CASCADE');
  await banco.query('CREATE SCHEMA public');
}

async function copiarMigrations(): Promise<string> {
  const diretorio = await mkdtemp(join(tmpdir(), 'migrations-teste-'));
  diretorios.push(diretorio);
  await cp(DIRETORIO_MIGRATIONS, diretorio, { recursive: true });
  return diretorio;
}

async function contarAplicadas(banco: Banco): Promise<number> {
  const resultado = await banco.query<{ total: string }>(
    'SELECT count(*) AS total FROM migracoes_aplicadas',
  );
  return Number(resultado.rows[0]?.total);
}

const banco = abrirBanco();

beforeEach(async () => {
  await recriarEsquema(banco);
});

afterAll(async () => {
  await Promise.all(bancos.map((aberto) => aberto.end()));
  await Promise.all(diretorios.map((d) => rm(d, { recursive: true, force: true })));
});

describe('aplicarMigracoes', () => {
  it('aplica as migrations existentes e registra nome e checksum SHA-256', async () => {
    const aplicadas = await aplicarMigracoes(banco, registrador);

    expect(aplicadas).toEqual(MIGRATIONS_ATUAIS);
    const linhas = await banco.query<{ versao: string; checksum: string }>(
      'SELECT versao, checksum FROM migracoes_aplicadas ORDER BY versao',
    );
    expect(linhas.rows.map((linha) => linha.versao)).toEqual(aplicadas);
    expect(linhas.rows.every((linha) => /^[0-9a-f]{64}$/.test(linha.checksum))).toBe(true);
    await expect(banco.query('SELECT count(*) FROM planos')).resolves.toBeDefined();
  });

  it('aplicar duas vezes não dá erro nem duplica', async () => {
    await aplicarMigracoes(banco, registrador);

    const segundaVez = await aplicarMigracoes(banco, registrador);

    expect(segundaVez).toEqual([]);
    expect(await contarAplicadas(banco)).toBe(MIGRATIONS_ATUAIS.length);
  });

  it('recusa iniciar quando uma migration já aplicada foi alterada', async () => {
    const diretorio = await copiarMigrations();
    await aplicarMigracoes(banco, registrador, diretorio);
    const arquivo = join(diretorio, '0002_planos.sql');
    await writeFile(arquivo, `${await readFile(arquivo, 'utf8')}\n-- alteração indevida\n`);

    await expect(aplicarMigracoes(banco, registrador, diretorio)).rejects.toThrow(
      /0002_planos\.sql.*alterada/,
    );
  });

  it('o mesmo arquivo com fim de linha do Windows tem o mesmo checksum', async () => {
    const diretorio = await copiarMigrations();
    await aplicarMigracoes(banco, registrador, diretorio);
    const arquivo = join(diretorio, '0002_planos.sql');
    const conteudo = await readFile(arquivo, 'utf8');
    await writeFile(arquivo, conteudo.replaceAll('\n', '\r\n'));

    await expect(aplicarMigracoes(banco, registrador, diretorio)).resolves.toEqual([]);
  });

  it('recusa iniciar quando uma migration já aplicada sumiu do disco', async () => {
    const diretorio = await copiarMigrations();
    await aplicarMigracoes(banco, registrador, diretorio);
    await rm(join(diretorio, '0002_planos.sql'));

    await expect(aplicarMigracoes(banco, registrador, diretorio)).rejects.toThrow(ErroDeMigracao);
  });

  it('duas instâncias migrando ao mesmo tempo não aplicam nada em duplicidade', async () => {
    const [primeira, segunda] = await Promise.all([
      aplicarMigracoes(abrirBanco(), registrador),
      aplicarMigracoes(abrirBanco(), registrador),
    ]);

    expect([...primeira, ...segunda].sort()).toEqual(MIGRATIONS_ATUAIS);
    expect(await contarAplicadas(banco)).toBe(MIGRATIONS_ATUAIS.length);
  });

  it('uma migration com erro é desfeita por inteiro e não fica registrada', async () => {
    const diretorio = await copiarMigrations();
    await writeFile(
      join(diretorio, '9999_quebrada.sql'),
      'CREATE TABLE parcial (id int);\nSELECT coluna_inexistente FROM parcial;\n',
    );

    await expect(aplicarMigracoes(banco, registrador, diretorio)).rejects.toThrow(/9999_quebrada/);

    expect(await contarAplicadas(banco)).toBe(MIGRATIONS_ATUAIS.length);
    const tabela = await banco.query("SELECT to_regclass('parcial') AS tabela");
    expect(tabela.rows[0]).toEqual({ tabela: null });
  });

  it('recusa arquivo com nome fora do padrão', async () => {
    const diretorio = await copiarMigrations();
    await writeFile(join(diretorio, 'sem-numero.sql'), 'SELECT 1;');

    await expect(aplicarMigracoes(banco, registrador, diretorio)).rejects.toThrow(/fora do padrão/);
  });
});
