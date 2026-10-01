import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { calcularHashDeUpload } from '../../../src/modules/comments/hash-conteudo.js';
import { decodificarTexto } from '../../../src/modules/uploads/parsing/detectar-codificacao.js';
import { detectarSeparador } from '../../../src/modules/uploads/parsing/detectar-separador.js';
import { interpretarData } from '../../../src/modules/uploads/parsing/interpretar-data.js';
import { lerLinhasCsv } from '../../../src/modules/uploads/parsing/leitor-csv.js';
import { transformarLinha } from '../../../src/modules/uploads/parsing/linha-para-comentario.js';
import { sugerirMapeamento } from '../../../src/modules/uploads/parsing/sugestoes-colunas.js';
import { codificarCsvWindows1252 } from '../../helpers/arquivos.js';

async function lerTudo(caminho: string): Promise<(string | number | Date | null)[][]> {
  const linhas = [];
  for await (const linha of lerLinhasCsv(caminho)) {
    linhas.push(linha);
  }
  return linhas;
}

describe('CSV', () => {
  let diretorio: string;
  beforeAll(async () => {
    diretorio = await mkdtemp(join(tmpdir(), 'csv-teste-'));
  });
  afterAll(async () => {
    await rm(diretorio, { recursive: true, force: true });
  });

  async function gravar(nome: string, conteudo: Buffer | string): Promise<string> {
    const caminho = join(diretorio, nome);
    await writeFile(caminho, conteudo);
    return caminho;
  }

  it('lê CSV com ponto e vírgula, inclusive vírgula decimal e aspas', async () => {
    const caminho = await gravar(
      'a.csv',
      'comentário;nota;data\n"Muito bom; voltarei";4,5;01/02/2024\nRuim;1;02/02/2024\n',
    );

    expect(await lerTudo(caminho)).toEqual([
      ['comentário', 'nota', 'data'],
      ['Muito bom; voltarei', '4,5', '01/02/2024'],
      ['Ruim', '1', '02/02/2024'],
    ]);
  });

  it('lê CSV com vírgula', async () => {
    const caminho = await gravar('b.csv', 'comentario,nota\nÓtimo,5\nLento,2\n');

    expect(await lerTudo(caminho)).toEqual([
      ['comentario', 'nota'],
      ['Ótimo', '5'],
      ['Lento', '2'],
    ]);
  });

  it('lê Windows-1252 com acentos', async () => {
    const caminho = await gravar(
      'c.csv',
      codificarCsvWindows1252('comentário;avaliação\nAtendimento excelente, não demorou;ótimo\n'),
    );

    expect(await lerTudo(caminho)).toEqual([
      ['comentário', 'avaliação'],
      ['Atendimento excelente, não demorou', 'ótimo'],
    ]);
  });

  it('lê UTF-8 com BOM sem deixar o BOM no nome da primeira coluna', async () => {
    const caminho = await gravar(
      'd.csv',
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('comentário;nota\nÓtimo;5\n')]),
    );

    const [cabecalho] = await lerTudo(caminho);

    expect(cabecalho).toEqual(['comentário', 'nota']);
  });

  it('ignora linhas em branco', async () => {
    const caminho = await gravar('e.csv', 'comentario;nota\n\nBom;5\n;\n\nRuim;1\n');

    expect(await lerTudo(caminho)).toHaveLength(3);
  });

  it('aceita exatamente 50.000 linhas de dados e recusa uma a mais', async () => {
    const cabecalho = 'comentario\n';
    const noLimite = await gravar('f.csv', cabecalho + 'texto longo o bastante\n'.repeat(50_000));
    const acima = await gravar('g.csv', cabecalho + 'texto longo o bastante\n'.repeat(50_001));

    expect(await lerTudo(noLimite)).toHaveLength(50_001);
    await expect(lerTudo(acima)).rejects.toMatchObject({ codigo: 'limite_de_linhas' });
  });
});

describe('detectarSeparador e decodificarTexto', () => {
  it('escolhe ; quando a vírgula só aparece como decimal', () => {
    expect(detectarSeparador('a;b;c\n1,5;2,5;3\n4,5;5;6,5\n')).toBe(';');
  });

  it('escolhe , quando não há ponto e vírgula', () => {
    expect(detectarSeparador('a,b,c\n1,2,3\n')).toBe(',');
  });

  it('detecta UTF-8 e cai para Windows-1252 quando o UTF-8 é inválido', () => {
    expect(decodificarTexto(Buffer.from('ação')).codificacao).toBe('utf-8');
    const legado = decodificarTexto(codificarCsvWindows1252('ação'));
    expect(legado).toEqual({ texto: 'ação', codificacao: 'windows-1252' });
  });
});

describe('interpretarData', () => {
  it.each([
    ['dd/mm/aaaa', '15/03/2024', '2024-03-15T03:00:00.000Z'],
    ['d/m/aaaa', '5/3/2024', '2024-03-05T03:00:00.000Z'],
    ['aaaa-mm-dd', '2024-03-15', '2024-03-15T03:00:00.000Z'],
    ['com hora', '15/03/2024 14:30', '2024-03-15T17:30:00.000Z'],
    ['serial do Excel como número', 45292, '2024-01-01T03:00:00.000Z'],
    ['serial do Excel como texto', '45292', '2024-01-01T03:00:00.000Z'],
    ['serial com hora', 45292.5, '2024-01-01T15:00:00.000Z'],
    ['Date do Excel', new Date(Date.UTC(2024, 2, 15)), '2024-03-15T03:00:00.000Z'],
  ])('lê %s', (_nome, entrada, esperado) => {
    expect(interpretarData(entrada)?.toISOString()).toBe(esperado);
  });

  it.each([
    ['dia inexistente', '31/02/2024'],
    ['mês inexistente', '10/13/2024'],
    ['texto', 'ontem'],
    ['vazio', ''],
    ['ano solto', '2024'],
    ['serial fora da faixa', 12],
    ['nulo', null],
  ])('devolve nulo para %s', (_nome, entrada) => {
    expect(interpretarData(entrada)).toBeNull();
  });
});

describe('sugerirMapeamento', () => {
  it('sugere pelo nome da coluna, sem repetir coluna', () => {
    expect(sugerirMapeamento(['Data', 'Nome do cliente', 'Comentário', 'Nota', 'Loja'])).toEqual({
      comentario: 2,
      data: 0,
      nota: 3,
      unidade: 4,
      autor: 1,
    });
  });

  it('entende nomes em inglês e sem acento', () => {
    expect(sugerirMapeamento(['id', 'Feedback', 'Rating'])).toEqual({ comentario: 1, nota: 2 });
  });

  it('não sugere nada quando nenhum nome combina', () => {
    expect(sugerirMapeamento(['x', 'y'])).toEqual({});
  });
});

describe('transformarLinha', () => {
  const mapeamento = { comentario: 0, nota: 1, data: 2, unidade: 3, autor: 4 };

  it('ignora comentário vazio ou com menos de 3 caracteres úteis', () => {
    expect(transformarLinha(['', '5'], mapeamento)).toEqual({ ignorada: true });
    expect(transformarLinha(['  ! ', '5'], mapeamento)).toEqual({ ignorada: true });
    expect(transformarLinha(['ok', '5'], mapeamento)).toEqual({ ignorada: true });
    expect(transformarLinha(['ótimo', '5'], mapeamento).ignorada).toBe(false);
  });

  it('lê nota, data, unidade e autor, e grava nulo quando não consegue', () => {
    const resultado = transformarLinha(
      ['Bom atendimento', '4,6', '15/03/2024', ' Loja 1 ', ''],
      mapeamento,
    );

    expect(resultado).toEqual({
      ignorada: false,
      comentario: {
        texto: 'Bom atendimento',
        nota: 5,
        comentadoEm: new Date('2024-03-15T03:00:00.000Z'),
        unidade: 'Loja 1',
        autor: null,
      },
    });
    expect(transformarLinha(['Bom atendimento', '9', 'xx'], mapeamento)).toMatchObject({
      comentario: { nota: null, comentadoEm: null },
    });
  });
});

describe('calcularHashDeUpload', () => {
  const base = { texto: 'Bom', comentadoEm: null, unidade: null, autor: null };

  it('ignora caixa e espaços duplicados no texto', () => {
    expect(calcularHashDeUpload({ ...base, texto: '  BOM   atendimento ' })).toBe(
      calcularHashDeUpload({ ...base, texto: 'bom atendimento' }),
    );
  });

  it('muda com data, unidade ou autor', () => {
    const hashes = new Set([
      calcularHashDeUpload(base),
      calcularHashDeUpload({ ...base, comentadoEm: new Date('2024-01-01T03:00:00Z') }),
      calcularHashDeUpload({ ...base, unidade: 'Loja 1' }),
      calcularHashDeUpload({ ...base, autor: 'Ana' }),
    ]);

    expect(hashes.size).toBe(4);
  });
});
