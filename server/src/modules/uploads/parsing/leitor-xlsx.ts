import { stat } from 'node:fs/promises';

import ExcelJS from 'exceljs';

import type { CelulaBruta } from '../envios.tipos.js';
import { erroAbaNaoEncontrada, erroArquivoInvalido, erroLimiteDeLinhas } from '../erros-envio.js';
import { LIMITE_LINHAS_ENVIO } from '../limites-envio.js';

// Planilha cujo workbook.xml vem depois das abas não cabe no leitor em fluxo; só arquivos pequenos entram em memória.
const TAMANHO_MAXIMO_LEITURA_EM_MEMORIA_BYTES = 10 * 1024 * 1024;

// Os tipos do exceljs omitem nome e estado da planilha emitida pelo leitor em fluxo.
interface PlanilhaEmFluxo extends AsyncIterable<{ values: unknown }> {
  name: string;
  state?: string;
}

interface Planilha {
  nome: string;
  oculta: boolean;
  linhas: AsyncIterable<unknown>;
}

function abrirLeitor(caminho: string): AsyncIterable<PlanilhaEmFluxo> {
  return new ExcelJS.stream.xlsx.WorkbookReader(caminho, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'cache',
    entries: 'ignore',
  }) as unknown as AsyncIterable<PlanilhaEmFluxo>;
}

function estaOculta(estado: string | undefined): boolean {
  return estado === 'hidden' || estado === 'veryHidden';
}

async function* valoresDasLinhas(planilha: PlanilhaEmFluxo): AsyncGenerator {
  for await (const linha of planilha) {
    yield linha.values;
  }
}

async function* valoresEmMemoria(valores: unknown[]): AsyncGenerator {
  await Promise.resolve();
  yield* valores;
}

async function* planilhasEmFluxo(caminho: string): AsyncGenerator<Planilha> {
  for await (const planilha of abrirLeitor(caminho)) {
    yield {
      nome: planilha.name,
      oculta: estaOculta(planilha.state),
      linhas: valoresDasLinhas(planilha),
    };
  }
}

async function* planilhasEmMemoria(caminho: string): AsyncGenerator<Planilha> {
  const { size } = await stat(caminho);
  if (size > TAMANHO_MAXIMO_LEITURA_EM_MEMORIA_BYTES) {
    throw erroArquivoInvalido();
  }
  const pasta = await new ExcelJS.Workbook().xlsx.readFile(caminho);
  for (const folha of pasta.worksheets) {
    const linhas: unknown[] = [];
    folha.eachRow({ includeEmpty: false }, (linha) => {
      linhas.push(linha.values);
    });
    yield { nome: folha.name, oculta: estaOculta(folha.state), linhas: valoresEmMemoria(linhas) };
  }
}

async function* planilhas(caminho: string): AsyncGenerator<Planilha> {
  let emitiu = false;
  try {
    for await (const planilha of planilhasEmFluxo(caminho)) {
      emitiu = true;
      yield planilha;
    }
  } catch (erro) {
    if (emitiu || !(erro instanceof TypeError)) {
      throw erro;
    }
    yield* planilhasEmMemoria(caminho);
  }
}

function converterCelula(valor: unknown): CelulaBruta {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor === 'string' || typeof valor === 'number' || valor instanceof Date) {
    return valor;
  }
  if (typeof valor === 'boolean') {
    return String(valor);
  }
  const objeto = valor as Record<string, unknown>;
  if (Array.isArray(objeto.richText)) {
    return (objeto.richText as { text?: string }[]).map((trecho) => trecho.text ?? '').join('');
  }
  if ('result' in objeto) {
    return converterCelula(objeto.result);
  }
  return typeof objeto.text === 'string' ? objeto.text : null;
}

function converterLinha(valores: unknown): CelulaBruta[] {
  const celulas = Array.isArray(valores) ? (valores as unknown[]) : [];
  return Array.from({ length: Math.max(celulas.length - 1, 0) }, (_vazio, indice) =>
    converterCelula(celulas[indice + 1]),
  );
}

function estaVazia(linha: CelulaBruta[]): boolean {
  return linha.every(
    (celula) => celula === null || (typeof celula === 'string' && celula.trim() === ''),
  );
}

export async function listarAbas(caminho: string): Promise<string[]> {
  const nomes: string[] = [];
  for await (const planilha of planilhas(caminho)) {
    if (!planilha.oculta) {
      nomes.push(planilha.nome);
    }
  }
  return nomes;
}

// Sem `aba`, lê a primeira visível; a leitura é em fluxo, sem carregar o arquivo inteiro.
export async function* lerLinhasXlsx(caminho: string, aba?: string): AsyncGenerator<CelulaBruta[]> {
  for await (const planilha of planilhas(caminho)) {
    if (planilha.oculta || (aba !== undefined && planilha.nome !== aba)) {
      continue;
    }
    let indice = 0;
    for await (const valores of planilha.linhas) {
      const celulas = converterLinha(valores);
      if (estaVazia(celulas)) {
        continue;
      }
      if (indice > LIMITE_LINHAS_ENVIO) {
        throw erroLimiteDeLinhas();
      }
      indice += 1;
      yield celulas;
    }
    return;
  }
  throw erroAbaNaoEncontrada();
}
