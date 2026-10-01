import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { validarConteudoDoEnvio } from '../../../src/modules/uploads/parsing/validar-conteudo.js';
import { listarAbas, lerLinhasXlsx } from '../../../src/modules/uploads/parsing/leitor-xlsx.js';
import { criarXlsx, criarZipComTamanhos } from '../../helpers/arquivos.js';

const MEGABYTE = 1024 * 1024;

describe('validarConteudoDoEnvio', () => {
  let diretorio: string;
  beforeAll(async () => {
    diretorio = await mkdtemp(join(tmpdir(), 'validar-teste-'));
  });
  afterAll(async () => {
    await rm(diretorio, { recursive: true, force: true });
  });

  async function validar(nome: string, conteudo: Buffer | string): Promise<string> {
    const caminho = join(diretorio, nome);
    await writeFile(caminho, conteudo);
    return validarConteudoDoEnvio(caminho, nome.slice(nome.lastIndexOf('.')));
  }

  it('aceita CSV e XLSX verdadeiros', async () => {
    const xlsx = await criarXlsx([{ nome: 'Aba', linhas: [['comentario'], ['bom']] }]);

    expect(await validar('ok.csv', 'a;b\n1;2\n')).toBe('csv');
    expect(await validar('ok.xlsx', xlsx)).toBe('xlsx');
  });

  it('rejeita .xls com a orientação de salvar como .xlsx', async () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);

    await expect(validar('antigo.xls', ole)).rejects.toMatchObject({
      codigo: 'formato_xls_nao_suportado',
      message: expect.stringContaining('.xlsx') as string,
    });
    await expect(validar('disfarcado.xlsx', ole)).rejects.toMatchObject({
      codigo: 'formato_xls_nao_suportado',
    });
  });

  it('rejeita .xlsx cujo conteúdo não é ZIP', async () => {
    await expect(validar('falso.xlsx', 'a;b\n1;2\n')).rejects.toMatchObject({
      codigo: 'arquivo_invalido',
    });
  });

  it('rejeita ZIP que não tem xl/workbook.xml', async () => {
    const zip = criarZipComTamanhos([{ nome: 'outro.txt', descompactado: 10 }]);

    await expect(validar('zip.xlsx', zip)).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  it('rejeita ZIP truncado ou sem diretório central', async () => {
    await expect(
      validar('truncado.xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])),
    ).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  it('rejeita CSV com bytes nulos, inclusive UTF-16', async () => {
    await expect(validar('nulo.csv', Buffer.from('a;b\0\n1;2\n'))).rejects.toMatchObject({
      codigo: 'arquivo_invalido',
    });
    await expect(validar('utf16.csv', Buffer.from('a;b\n', 'utf16le'))).rejects.toMatchObject({
      codigo: 'arquivo_invalido',
    });
  });

  it('rejeita extensão desconhecida e ZIP com extensão .csv', async () => {
    await expect(validar('a.pdf', '%PDF')).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
    const zip = criarZipComTamanhos([{ nome: 'xl/workbook.xml', descompactado: 10 }]);
    await expect(validar('zip.csv', zip)).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  it('recusa o ZIP que descompacta acima do limite, sem extrair', async () => {
    const bomba = criarZipComTamanhos([
      { nome: 'xl/workbook.xml', descompactado: 150 * MEGABYTE },
      { nome: 'xl/worksheets/sheet1.xml', descompactado: 100 * MEGABYTE },
    ]);

    await expect(validar('bomba.xlsx', bomba)).rejects.toMatchObject({
      codigo: 'arquivo_descompactado_grande',
    });
  });
});

describe('leitor de XLSX', () => {
  let diretorio: string;
  beforeAll(async () => {
    diretorio = await mkdtemp(join(tmpdir(), 'xlsx-teste-'));
  });
  afterAll(async () => {
    await rm(diretorio, { recursive: true, force: true });
  });

  it('lista as abas, lê a escolhida em fluxo e converte tipos de célula', async () => {
    const caminho = join(diretorio, 'dois.xlsx');
    await writeFile(
      caminho,
      await criarXlsx([
        { nome: 'Resumo', linhas: [['x'], ['y']] },
        {
          nome: 'Avaliações',
          linhas: [
            ['comentário', 'nota', 'data'],
            ['Ótimo', 5, new Date(Date.UTC(2024, 0, 2))],
            [null, null, null],
            ['Ruim', 1, '03/01/2024'],
          ],
        },
      ]),
    );

    const linhas = [];
    for await (const linha of lerLinhasXlsx(caminho, 'Avaliações')) {
      linhas.push(linha);
    }

    expect(await listarAbas(caminho)).toEqual(['Resumo', 'Avaliações']);
    expect(linhas).toEqual([
      ['comentário', 'nota', 'data'],
      ['Ótimo', 5, new Date(Date.UTC(2024, 0, 2))],
      ['Ruim', 1, '03/01/2024'],
    ]);
  });

  it('usa a primeira aba por padrão e recusa aba inexistente', async () => {
    const caminho = join(diretorio, 'um.xlsx');
    await writeFile(caminho, await criarXlsx([{ nome: 'Única', linhas: [['a'], ['b']] }]));

    const primeira = [];
    for await (const linha of lerLinhasXlsx(caminho)) {
      primeira.push(linha);
    }
    const inexistente = lerLinhasXlsx(caminho, 'Nada').next();

    expect(primeira).toEqual([['a'], ['b']]);
    await expect(inexistente).rejects.toMatchObject({ codigo: 'aba_nao_encontrada' });
  });
});
